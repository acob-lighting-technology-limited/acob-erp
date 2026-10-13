import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { lineItemsTotal } from "@/lib/requisitions/limits"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import { notifyRequisitionEvent } from "@/lib/requisitions/notify"
import { resolveRequisitionStages } from "@/lib/requisitions/routing"
import { parseCreateRequisition } from "@/lib/requisitions/schemas"
import { REQUISITION_LIST_SELECT, getViewerContext, loadRequisition, loadRoutingLeads } from "@/lib/requisitions/server"
import { isOwnUploadPath, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import type { Requisition } from "@/lib/requisitions/types"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { normalizeDepartmentName } from "@/shared/departments"

const ListQuerySchema = z.object({
  view: z.enum(["mine", "action", "payment", "all", "department"]).default("mine"),
  department: z.string().trim().max(120).optional(),
})

/**
 * GET /api/requisitions?view=
 *   mine        what I raised
 *   action      what is waiting on my signature
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
    const viewerFlags = { is_admin: viewer.isAdminLike, is_payment_processor: viewer.isPaymentProcessor }
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
      query = query.in("id", ids).eq("status", "pending").neq("user_id", user.id)
    } else if (view === "payment") {
      if (!viewer.isPaymentProcessor) return empty()
      query = query.in("status", ["awaiting_payment", "partly_paid"]).neq("user_id", user.id)
    } else if (view === "all") {
      if (!viewer.isAdminLike && !viewer.isPaymentProcessor) {
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
    const rows = (data || []).map((req) => ({
      ...req,
      stages: [...(req.stages || [])].sort((a, b) => a.position - b.position),
    }))
    return NextResponse.json({ data: rows, viewer: viewerFlags })
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

    let fundingCategoryName: string | null = null
    if (input.funding_category_id) {
      const { data: category } = await admin
        .from("requisition_funding_categories")
        .select("name, is_active")
        .eq("id", input.funding_category_id)
        .maybeSingle()
      if (!category?.is_active) {
        return apiError("That funding category is no longer available", ApiErrorCode.VALIDATION_ERROR, 400)
      }
      fundingCategoryName = category.name
    }

    if (input.help_desk_ticket_id) {
      const { data: ticket } = await admin
        .from("help_desk_tickets")
        .select("id")
        .eq("id", input.help_desk_ticket_id)
        .maybeSingle()
      if (!ticket) return apiError("That help desk ticket was not found", ApiErrorCode.NOT_FOUND, 404)
    }

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
        project_name: input.form_type === "payment_request" ? input.project_name : null,
        purpose: input.form_type === "payment_request" ? input.purpose : null,
        site_location: input.form_type === "payment_request" ? input.site_location || null : null,
        amount,
        amount_in_words: numberToNairaWords(amount),
        line_items: input.form_type === "petty_cash" ? input.line_items : [],
        beneficiary_details: input.beneficiary_details,
        attachments: input.attachments || [],
        funding_category_id: input.funding_category_id || null,
        funding_category_name: fundingCategoryName,
        help_desk_ticket_id: input.help_desk_ticket_id || null,
      },
      p_stages: stages,
    })
    if (error) throw error

    const id = (created as { id: string }).id
    const req = await loadRequisition(admin, id)
    if (req) await notifyRequisitionEvent(admin, { kind: "submitted", req })

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
