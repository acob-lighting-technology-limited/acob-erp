import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { verifyActionPin } from "@/lib/approval-signing/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { amountChangeMessage, lineItemsTotal } from "@/lib/requisitions/limits"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import { notifyRequisitionEvent } from "@/lib/requisitions/notify"
import { RequisitionActSchema } from "@/lib/requisitions/schemas"
import { findSignableStage, loadRequisition } from "@/lib/requisitions/server"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/requisitions/[id]/act
 *   { action: "sign", pin, comments?, amount_change? }
 *   { action: "reject", pin, reason }
 *
 * Signs the earliest pending stage the caller holds; any pending stage before
 * it is bypassed. Always confirmed with the caller's PIN.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`requisition-act:${getClientId(request)}`, { limit: 30, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  const parsed = RequisitionActSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid request", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  const body = parsed.data

  try {
    const req = await loadRequisition(admin, id)
    if (!req) return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)

    // Check the caller can act before spending a PIN attempt on it.
    const signable = findSignableStage(req, user.id)
    if (!signable) {
      const reason =
        req.user_id === user.id
          ? "You cannot sign your own requisition."
          : req.status !== "pending"
            ? "This requisition has already moved on."
            : "This requisition is not waiting on you."
      return apiError(reason, ApiErrorCode.FORBIDDEN, 403)
    }

    let amountChange: Record<string, unknown> | null = null
    if (body.action === "sign" && body.amount_change) {
      const change = body.amount_change
      const lineItems = req.form_type === "petty_cash" ? change.line_items : undefined
      if (req.form_type === "petty_cash" && !lineItems) {
        return apiError("Change the item amounts to change a petty cash total.", ApiErrorCode.VALIDATION_ERROR, 400)
      }
      const newAmount = lineItems ? lineItemsTotal(lineItems) : change.amount
      if (newAmount == null) return apiError("Enter the new amount.", ApiErrorCode.VALIDATION_ERROR, 400)

      const problem = amountChangeMessage(req.form_type, Number(req.amount), newAmount)
      if (problem) return apiError(problem, ApiErrorCode.VALIDATION_ERROR, 400)

      const beneficiaries = change.beneficiary_details ?? req.beneficiary_details
      if (beneficiaries.length > 1 && beneficiaries.some((b) => b.amount != null)) {
        const split = lineItemsTotal(beneficiaries.map((b) => ({ amount: b.amount ?? 0 })))
        if (Math.abs(split - newAmount) > 0.001) {
          return apiError(
            "Re-split the beneficiaries' amounts so they add up to the new total.",
            ApiErrorCode.VALIDATION_ERROR,
            400
          )
        }
      }

      amountChange = {
        amount: newAmount,
        amount_in_words: numberToNairaWords(newAmount),
        reason: change.reason,
        ...(lineItems ? { line_items: lineItems } : {}),
        ...(change.beneficiary_details ? { beneficiary_details: change.beneficiary_details } : {}),
      }
    }

    const signaturePath = await verifyActionPin(admin, user.id, body.pin)

    let result: Record<string, unknown>
    if (body.action === "sign") {
      const { data, error } = await admin.rpc("requisition_sign", {
        p_requisition_id: id,
        p_actor_id: user.id,
        p_comments: body.comments || null,
        p_signature_path: signaturePath,
        p_amount_change: amountChange,
      })
      if (error) throw error
      result = data as Record<string, unknown>
    } else {
      const { data, error } = await admin.rpc("requisition_reject", {
        p_requisition_id: id,
        p_actor_id: user.id,
        p_reason: body.reason,
      })
      if (error) throw error
      result = data as Record<string, unknown>
    }

    const updated = await loadRequisition(admin, id)
    if (updated) {
      await notifyRequisitionEvent(
        admin,
        body.action === "sign"
          ? {
              kind: "signed",
              req: updated,
              actorId: user.id,
              bypassedStageIds: (result.bypassed_stage_ids as string[]) || [],
              amountChanged: Boolean(amountChange),
            }
          : { kind: "rejected", req: updated, actorId: user.id }
      )
    }

    await writeAuditLog(
      supabase,
      {
        action: body.action === "sign" ? "approve" : "reject",
        entityType: "requisition",
        entityId: id,
        oldValues: { status: req.status, amount: req.amount },
        newValues: {
          status: updated?.status,
          amount: updated?.amount,
          stage: result.stage_code,
          bypassed_stage_ids: result.bypassed_stage_ids,
          ...(amountChange ? { amount_change_reason: amountChange.reason } : {}),
        },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/${id}/act` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updated, result })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to act on requisition")
  }
}
