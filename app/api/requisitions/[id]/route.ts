import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { verifyActionPin } from "@/lib/approval-signing/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { PETTY_CASH_MAX, lineItemsTotal } from "@/lib/requisitions/limits"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import { confirmBeneficiaries } from "@/lib/requisitions/paystack"
import { PaymentRequestSchema, PettyCashSchema } from "@/lib/requisitions/schemas"
import {
  canViewRequisition,
  getViewerActions,
  getViewerContext,
  loadRequisition,
  withSignedUrls,
} from "@/lib/requisitions/server"
import { isOwnUploadPath, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

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
    if (req.status !== "pending") {
      return apiError("This has moved on, so it can no longer be changed.", ApiErrorCode.VALIDATION_ERROR, 409)
    }
    if ((req.stages || []).some((s) => s.state === "signed" || s.state === "bypassed" || s.state === "rejected")) {
      return apiError(
        "Someone has already signed this, so it can no longer be changed.",
        ApiErrorCode.VALIDATION_ERROR,
        409
      )
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
    const exceptionReason =
      input.form_type === "petty_cash" && amount > PETTY_CASH_MAX ? (input.exception_reason ?? null) : null

    // Only while still pending: the status is checked again in the same write.
    const { data: updated, error } = await admin
      .from("requisitions")
      .update({
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
      .eq("status", "pending")
      .select("id")
      .maybeSingle()
    if (error) throw error
    if (!updated) {
      return apiError("This has moved on, so it can no longer be changed.", ApiErrorCode.VALIDATION_ERROR, 409)
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
