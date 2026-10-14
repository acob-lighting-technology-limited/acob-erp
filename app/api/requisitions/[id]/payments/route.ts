import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { verifyActionPin } from "@/lib/approval-signing/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { notifyRequisitionEvent } from "@/lib/requisitions/notify"
import { RecordPaymentSchema } from "@/lib/requisitions/schemas"
import { getViewerContext, loadRequisition } from "@/lib/requisitions/server"
import { isOwnUploadPath, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/requisitions/[id]/payments — record a payment (Processed By).
 * Several payments may add up to the approved amount; never more.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`requisition-payment:${getClientId(request)}`, { limit: 30, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  const parsed = RecordPaymentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid payment", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  const body = parsed.data

  try {
    const [req, viewer] = await Promise.all([loadRequisition(admin, id), getViewerContext(admin, user.id)])
    if (!req) return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)
    if (!viewer.isPaymentProcessor) {
      return apiError("You are not set up to record payments.", ApiErrorCode.FORBIDDEN, 403)
    }
    if (req.user_id === user.id) {
      return apiError("You cannot record payment on your own requisition.", ApiErrorCode.FORBIDDEN, 403)
    }
    if (req.status !== "awaiting_payment" && req.status !== "partly_paid") {
      return apiError("This requisition is not waiting for payment.", ApiErrorCode.VALIDATION_ERROR, 409)
    }
    if (body.receipt_path && !isOwnUploadPath(body.receipt_path, user.id)) {
      return apiError("Attach only a receipt you uploaded", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    const signaturePath = await verifyActionPin(admin, user.id, body.pin)

    const { data, error } = await admin.rpc("requisition_record_payment", {
      p_requisition_id: id,
      p_actor_id: user.id,
      p_amount: body.amount,
      p_paid_on: body.paid_on,
      p_method: body.method,
      p_reference: body.reference || null,
      p_receipt_path: body.receipt_path || null,
      p_note: body.note || null,
      p_signature_path: signaturePath,
    })
    if (error) throw error

    const updated = await loadRequisition(admin, id)
    if (updated)
      await notifyRequisitionEvent(admin, { kind: "payment", req: updated, actorId: user.id, amount: body.amount })

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition",
        entityId: id,
        oldValues: { status: req.status, amount_paid: req.amount_paid },
        newValues: { status: updated?.status, amount_paid: updated?.amount_paid, payment: body.amount },
        metadata: { event: "payment_recorded", method: body.method, reference: body.reference || null },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/${id}/payments` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updated, result: data })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to record payment")
  }
}
