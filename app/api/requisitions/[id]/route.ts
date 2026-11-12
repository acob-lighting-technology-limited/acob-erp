import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { verifyActionPin } from "@/lib/approval-signing/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { amountOutOfRangeMessage, lineItemsTotal } from "@/lib/requisitions/limits"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import { notifyRequisitionEvent } from "@/lib/requisitions/notify"
import { confirmBeneficiaries } from "@/lib/requisitions/paystack"
import { resolveRequisitionStages } from "@/lib/requisitions/routing"
import { PaymentRequestSchema, PettyCashSchema } from "@/lib/requisitions/schemas"
import {
  canViewRequisition,
  getViewerActions,
  getViewerContext,
  loadRequisition,
  loadRoutingLeads,
  withSignedUrls,
} from "@/lib/requisitions/server"
import { isOwnUploadPath, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { normalizeDepartmentName } from "@/shared/departments"

/** GET /api/requisitions/[id] — the requisition, its history, and what the viewer may do. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin } = auth
  const { id } = await params

  try {
    const [req, viewer] = await Promise.all([loadRequisition(admin, id), getViewerContext(admin, user.id)])
    // Same answer for "missing" and "not yours", so ids cannot be probed.
    if (!req || !canViewRequisition(req, viewer)) {
      return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)
    }

    return NextResponse.json({
      data: await withSignedUrls(admin, req),
      viewer: {
        ...(await getViewerActions(admin, req, viewer)),
        is_admin: viewer.isAdminLike,
      },
    })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load requisition")
  }
}

/**
 * PATCH /api/requisitions/[id] — the requester changes their own form while it is
 * still pending and nobody has signed past them. The body is the same as a new
 * requisition of the same form type; submitting re-signs "Requested by" with the PIN.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  // Same validation as a new requisition, picked by form type (the form type is never changed here).
  const body = await request.json().catch(() => null)
  const schema =
    (body as { form_type?: unknown } | null)?.form_type === "petty_cash" ? PettyCashSchema : PaymentRequestSchema
  const parsed = schema.safeParse(body)
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
    const req = await loadRequisition(admin, id)
    if (!req || req.user_id !== user.id) return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)
    // A rejected form goes back into approval under the same number; a pending one is changed in place.
    const resubmitting = req.status === "rejected"
    if (!resubmitting) {
      if (req.status !== "pending") {
        return apiError("This has moved on, so it can no longer be changed.", ApiErrorCode.VALIDATION_ERROR, 409)
      }
      if ((req.stages || []).some((s) => s.state === "signed" || s.state === "bypassed")) {
        return apiError(
          "Someone has already signed this, so it can no longer be changed.",
          ApiErrorCode.VALIDATION_ERROR,
          409
        )
      }
    }
    if (input.form_type !== req.form_type) {
      return apiError(
        "The form type cannot change here. Use Convert to change the form.",
        ApiErrorCode.VALIDATION_ERROR,
        400
      )
    }
    if ((input.attachments || []).some((file) => !isOwnUploadPath(file.file_path, user.id))) {
      return apiError("Attach only files you uploaded", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    // Changing the form re-signs "Requested by", so the PIN is checked again.
    const requesterSignaturePath = await verifyActionPin(admin, user.id, input.pin)

    let projectName: string | null = null
    let projectLocation: string | null = null
    if (input.form_type === "payment_request") {
      if (input.project_id) {
        const { data } = await admin
          .from("projects")
          .select("project_name, location")
          .eq("id", input.project_id)
          .maybeSingle()
        if (!data) return apiError("That project no longer exists. Pick it again.", ApiErrorCode.VALIDATION_ERROR, 400)
        projectName = data.project_name
        projectLocation = data.location
      } else {
        projectName = input.project_name
      }
    }

    const confirmed = await confirmBeneficiaries(input.beneficiary_details)
    if (!confirmed.ok) return apiError(confirmed.message, ApiErrorCode.VALIDATION_ERROR, 400)

    const amount = input.form_type === "petty_cash" ? lineItemsTotal(input.line_items) : input.amount
    const exceptionReason = amountOutOfRangeMessage(input.form_type, amount) ? (input.exception_reason ?? null) : null

    // A resubmitted form starts approval again: its stages are routed afresh from the requester's current profile.
    if (resubmitting) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, department, is_department_lead, lead_departments")
        .eq("id", user.id)
        .maybeSingle()
      const department = normalizeDepartmentName(profile?.department)
      if (!profile || !department) {
        return apiError(
          "Your profile has no department, so the requisition cannot be routed.",
          ApiErrorCode.VALIDATION_ERROR,
          400
        )
      }
      const stages = resolveRequisitionStages(req.form_type, { ...profile, department }, await loadRoutingLeads(admin))
      const { error: deleteError } = await admin.from("requisition_stages").delete().eq("requisition_id", id)
      if (deleteError) throw deleteError
      const { error: insertError } = await admin.from("requisition_stages").insert(
        stages.map((s) => ({
          requisition_id: id,
          position: s.position,
          stage_code: s.stage_code,
          role_key: s.role_key,
          role_label: s.role_label,
          assignee_id: s.assignee_id,
          state: s.state,
          state_note: s.state_note,
        }))
      )
      if (insertError) throw insertError
    }

    // Only while the status is unchanged: the same write checks it.
    const { data: updated, error } = await admin
      .from("requisitions")
      .update({
        ...(resubmitting ? { status: "pending", rejected_by: null, rejected_at: null, rejection_reason: null } : {}),
        amount,
        original_amount: req.original_amount ?? req.amount,
        amount_in_words: numberToNairaWords(amount),
        line_items: input.form_type === "petty_cash" ? input.line_items : [],
        beneficiary_details: confirmed.beneficiaries,
        attachments: input.attachments || [],
        requester_signature_path: requesterSignaturePath,
        project_name: input.form_type === "payment_request" ? projectName : null,
        purpose: input.form_type === "payment_request" ? input.purpose : null,
        site_location: input.form_type === "payment_request" ? projectLocation : null,
        exception_reason: exceptionReason,
      })
      .eq("id", id)
      .eq("status", req.status)
      .select("id")
      .maybeSingle()
    if (error) throw error
    if (!updated) {
      return apiError("This has moved on, so it can no longer be changed.", ApiErrorCode.VALIDATION_ERROR, 409)
    }
    if (resubmitting) {
      const submitted = await loadRequisition(admin, id)
      if (submitted) await notifyRequisitionEvent(admin, { kind: "submitted", req: submitted })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition",
        entityId: id,
        oldValues: { amount: req.amount, beneficiary_details: req.beneficiary_details },
        newValues: { amount, beneficiary_details: confirmed.beneficiaries },
        context: { actorId: user.id, source: "api", route: "/api/requisitions/[id]" },
      },
      { failOpen: true }
    )

    const fresh = await loadRequisition(admin, id)
    return NextResponse.json({ data: fresh, message: `${req.requisition_number} updated` })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to update requisition")
  }
}
