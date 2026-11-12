import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { amountOutOfRangeMessage, lineItemsTotal } from "@/lib/requisitions/limits"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import { notifyRequisitionEvent } from "@/lib/requisitions/notify"
import { verifyActionPin } from "@/lib/approval-signing/server"
import { confirmBeneficiaries } from "@/lib/requisitions/paystack"
import { resolveRequisitionStages } from "@/lib/requisitions/routing"
import { parseCreateRequisition } from "@/lib/requisitions/schemas"
import {
  REQUISITION_LIST_SELECT,
  findSignableStage,
  getViewerContext,
  loadPaymentOfficers,
  loadRequisition,
  loadRoutingLeads,
} from "@/lib/requisitions/server"
import { scheduleAccess } from "@/lib/requisitions/schedules"
import { isOwnUploadPath, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import type { Requisition } from "@/lib/requisitions/types"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { normalizeDepartmentName } from "@/shared/departments"

const ListQuerySchema = z.object({
  view: z.enum(["mine", "action", "signed", "payment", "all", "department"]).default("mine"),
  department: z.string().trim().max(120).optional(),
})

/**
 * GET /api/requisitions?view=
 *   mine        what I raised
 *   action      what is waiting on my signature
 *   signed      what I signed, overrode, rejected or recorded a payment on
 *   payment     what is waiting to be paid (payment processors)
 *   all         everything (admins, payment processors)
 *   department  one department (&department=; its lead or an admin)
 */
export async function GET(request: NextRequest) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin } = auth

  const parsed = ListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return apiError("Invalid list filter", ApiErrorCode.VALIDATION_ERROR, 400)
  const { view } = parsed.data

  try {
    const viewer = await getViewerContext(admin, user.id)
    const access = await scheduleAccess(admin, viewer)
    const viewerFlags = {
      is_admin: viewer.isAdminLike,
      is_payment_processor: viewer.paymentFormTypes.length > 0,
      can_manage_schedules: access.isOfficer,
    }
    const empty = () => NextResponse.json({ data: [], viewer: viewerFlags })
    let query = admin.from("requisitions").select(REQUISITION_LIST_SELECT).order("created_at", { ascending: false })

    if (view === "mine") {
      query = query.eq("user_id", user.id)
    } else if (view === "action") {
      const { data: stages, error } = await admin
        .from("requisition_stages")
        .select("requisition_id")
        .eq("assignee_id", user.id)
        .eq("state", "pending")
      if (error) throw error
      const ids = Array.from(new Set((stages || []).map((s) => s.requisition_id as string)))
      if (!ids.length) return empty()
      // In approval, or (Payment Requests) paid and waiting for the MD's Approved signature.
      query = query.in("id", ids).in("status", ["pending", "awaiting_approval"]).neq("user_id", user.id)
    } else if (view === "signed") {
      const [{ data: acted, error: actedError }, { data: paid, error: paidError }] = await Promise.all([
        admin.from("requisition_stages").select("requisition_id").eq("acted_by", user.id),
        admin.from("requisition_payments").select("requisition_id").eq("recorded_by", user.id),
      ])
      if (actedError) throw actedError
      if (paidError) throw paidError
      const ids = Array.from(new Set([...(acted || []), ...(paid || [])].map((r) => r.requisition_id as string)))
      if (!ids.length) return empty()
      query = query.in("id", ids)
    } else if (view === "payment") {
      // Each officer's queue holds only the forms they were chosen for.
      if (!viewer.paymentFormTypes.length) return empty()
      query = query
        .in("status", ["awaiting_payment", "scheduled", "partly_paid"])
        .in("form_type", viewer.paymentFormTypes)
        .neq("user_id", user.id)
    } else if (view === "all") {
      if (!viewer.isAdminLike && !viewer.paymentFormTypes.length) {
        return apiError("You cannot view every requisition", ApiErrorCode.FORBIDDEN, 403)
      }
    } else {
      const department = normalizeDepartmentName(parsed.data.department)
      if (!department) return apiError("Pick a department", ApiErrorCode.VALIDATION_ERROR, 400)
      if (!viewer.isAdminLike && !viewer.leadDepartments.includes(department)) {
        return apiError("You cannot view this department's requisitions", ApiErrorCode.FORBIDDEN, 403)
      }
      query = query.eq("department", department)
    }

    const { data, error } = await query.returns<Requisition[]>()
    if (error) throw error
    // sign_stage_id lets the table offer Sign and Reject on the rows she can act on.
    const officers = await loadPaymentOfficers(admin)
    const rows = (data || []).map((req) => ({
      ...req,
      payment_officers: officers[req.form_type] ?? [],
      // The requester can update a rejected form: edit it and resubmit, or convert it.
      can_update: req.user_id === user.id && req.status === "rejected",
      // Payment Requests are paid through payment schedules.
      can_pay:
        req.form_type === "petty_cash" &&
        viewer.paymentFormTypes.includes(req.form_type) &&
        req.user_id !== user.id &&
        (req.status === "awaiting_payment" || req.status === "partly_paid"),
      stages: [...(req.stages || [])].sort((a, b) => a.position - b.position),
      sign_stage_id: findSignableStage(req, user.id)?.stage.id ?? null,
    }))
    // "Needs my signature" lists only what the viewer can sign now.
    const visible = view === "action" ? rows.filter((r) => r.sign_stage_id) : rows
    return NextResponse.json({ data: visible, viewer: viewerFlags })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to list requisitions")
  }
}

/** POST /api/requisitions — raise a Payment Request or a Petty Cash voucher. */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`requisition-create:${getClientId(request)}`, { limit: 20, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth

  const parsed = parseCreateRequisition(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message || "Check the form and try again",
      ApiErrorCode.VALIDATION_ERROR,
      400,
      parsed.error.issues
    )
  }
  const input = parsed.data

  try {
    const { data: requester } = await admin
      .from("profiles")
      .select("id, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .maybeSingle()
    const department = normalizeDepartmentName(requester?.department)
    if (!requester || !department) {
      return apiError(
        "Your profile has no department, so the requisition cannot be routed. Ask HR to set it.",
        ApiErrorCode.VALIDATION_ERROR,
        400
      )
    }

    if ((input.attachments || []).some((file) => !isOwnUploadPath(file.file_path, user.id))) {
      return apiError("Attach only files you uploaded", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    // Submitting signs "Requested by": the PIN is checked and that signature is stamped on the form.
    const requesterSignaturePath = await verifyActionPin(admin, user.id, input.pin)

    // A listed project supplies its own name; the browser's copy is not trusted. Its location is
    // kept on the requisition for the record, though forms no longer show a site location.
    let project: { project_name: string; location: string | null } | null = null
    if (input.form_type === "payment_request" && input.project_id) {
      const { data } = await admin
        .from("projects")
        .select("project_name, location")
        .eq("id", input.project_id)
        .maybeSingle()
      if (!data) return apiError("That project no longer exists. Pick it again.", ApiErrorCode.VALIDATION_ERROR, 400)
      project = data
    }

    // Converting a rejected requisition: it must be the requester's, rejected, and changed to the other form type.
    if (input.converted_from_id) {
      const source = await loadRequisition(admin, input.converted_from_id)
      if (!source || source.user_id !== user.id) {
        return apiError("That requisition was not found", ApiErrorCode.NOT_FOUND, 404)
      }
      if (source.status !== "rejected") {
        return apiError("Only a rejected requisition can be converted", ApiErrorCode.VALIDATION_ERROR, 409)
      }
      if (source.form_type === input.form_type) {
        return apiError("Pick the other form type to convert it", ApiErrorCode.VALIDATION_ERROR, 400)
      }
      const { count } = await admin
        .from("requisitions")
        .select("id", { count: "exact", head: true })
        .eq("converted_from_id", source.id)
      if ((count ?? 0) > 0) {
        return apiError("This requisition has already been converted", ApiErrorCode.VALIDATION_ERROR, 409)
      }
    }

    const confirmed = await confirmBeneficiaries(input.beneficiary_details)
    if (!confirmed.ok) return apiError(confirmed.message, ApiErrorCode.VALIDATION_ERROR, 400)

    const amount = input.form_type === "petty_cash" ? lineItemsTotal(input.line_items) : input.amount
    const stages = resolveRequisitionStages(
      input.form_type,
      { ...requester, department },
      await loadRoutingLeads(admin)
    )

    const { data: created, error } = await admin.rpc("requisition_create", {
      p_requisition: {
        user_id: user.id,
        form_type: input.form_type,
        department,
        project_name: input.form_type === "payment_request" ? project?.project_name || input.project_name : null,
        purpose: input.form_type === "payment_request" ? input.purpose : null,
        site_location: input.form_type === "payment_request" ? project?.location || null : null,
        amount,
        amount_in_words: numberToNairaWords(amount),
        line_items: input.form_type === "petty_cash" ? input.line_items : [],
        beneficiary_details: confirmed.beneficiaries,
        requester_signature_path: requesterSignaturePath,
        attachments: input.attachments || [],
        // Only an amount outside its form's range carries an exception reason.
        exception_reason: amountOutOfRangeMessage(input.form_type, amount) ? (input.exception_reason ?? null) : null,
        converted_from_id: input.converted_from_id ?? null,
      },
      p_stages: stages,
    })
    if (error) throw error

    const id = (created as { id: string }).id
    const req = await loadRequisition(admin, id)
    if (req) {
      await notifyRequisitionEvent(admin, { kind: "submitted", req })
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "requisition",
        entityId: id,
        newValues: {
          requisition_number: req?.requisition_number,
          form_type: input.form_type,
          amount,
          stages: stages.map((s) => ({ stage: s.stage_code, assignee: s.assignee_id, state: s.state })),
        },
        context: { actorId: user.id, source: "api", route: "/api/requisitions" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: req, message: `${req?.requisition_number} submitted` }, { status: 201 })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to create requisition")
  }
}
