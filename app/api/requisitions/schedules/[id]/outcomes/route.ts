import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { verifyActionPin } from "@/lib/approval-signing/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { notifyRequisitionEvent, notifyScheduleForMd } from "@/lib/requisitions/notify"
import { ScheduleOutcomesSchema } from "@/lib/requisitions/schemas"
import { getViewerContext, loadRequisition } from "@/lib/requisitions/server"
import { loadSchedule, scheduleAccess } from "@/lib/requisitions/schedules"
import { isOwnUploadPath, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/requisitions/schedules/[id]/outcomes
 *   { paid_on, pin, outcomes: [{ item_id, outcome: "paid"|"unpaid", bank_reference?, receipt_path?, note? }] }
 *
 * After the MD has paid at the bank: paid lines become payments signed by the
 * officer; unpaid lines go back to the pool, and the requester and signers are
 * told so they can follow up. Lines can be recorded over several passes.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`requisition-schedule-outcomes:${getClientId(request)}`, { limit: 20, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  const parsed = ScheduleOutcomesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid outcomes", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  const body = parsed.data

  try {
    const viewer = await getViewerContext(admin, user.id)
    const access = await scheduleAccess(admin, viewer)
    if (!access.isOfficer) {
      return apiError("Only Payment Request officers can record payments.", ApiErrorCode.FORBIDDEN, 403)
    }
    if (body.outcomes.some((o) => o.receipt_path && !isOwnUploadPath(o.receipt_path, user.id))) {
      return apiError("Attach only receipts you uploaded", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    const before = await loadSchedule(admin, id)
    if (!before) return apiError("Payment schedule not found", ApiErrorCode.NOT_FOUND, 404)

    const signaturePath = await verifyActionPin(admin, user.id, body.pin)

    const { data, error } = await admin.rpc("requisition_schedule_record_outcomes", {
      p_schedule_id: id,
      p_actor_id: user.id,
      p_paid_on: body.paid_on,
      p_outcomes: body.outcomes,
      p_signature_path: signaturePath,
    })
    if (error) throw error
    const result = data as { paid: number; unpaid: number; requisition_ids: string[] }

    // Tell each requisition's people what happened to it.
    const itemsById = new Map((before.items || []).map((i) => [i.id, i]))
    let readyCount = 0
    let readyTotal = 0
    for (const reqId of result.requisition_ids) {
      const req = await loadRequisition(admin, reqId)
      if (!req) continue
      const mine = body.outcomes.filter((o) => itemsById.get(o.item_id)?.requisition_id === reqId)
      const paidAmount = mine
        .filter((o) => o.outcome === "paid")
        .reduce((sum, o) => sum + Number(itemsById.get(o.item_id)?.amount || 0), 0)
      const unpaid = mine.filter((o) => o.outcome === "unpaid")
      if (paidAmount > 0) {
        await notifyRequisitionEvent(admin, { kind: "payment", req, actorId: user.id, amount: paidAmount })
      }
      if (unpaid.length) {
        await notifyRequisitionEvent(admin, {
          kind: "unpaid",
          req,
          actorId: user.id,
          note: unpaid.map((o) => o.note).join("; "),
          scheduleNumber: before.schedule_number,
        })
      }
      if (req.status === "awaiting_approval") {
        readyCount += 1
        readyTotal += Number(req.amount)
      }
    }
    await notifyScheduleForMd(admin, {
      mdId: access.mdId,
      actorId: user.id,
      scheduleId: id,
      scheduleNumber: before.schedule_number,
      kind: "approve",
      count: readyCount,
      total: readyTotal,
    })

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition_schedule",
        entityId: id,
        newValues: { paid: result.paid, unpaid: result.unpaid, paid_on: body.paid_on },
        metadata: {
          event: "schedule_outcomes_recorded",
          lines: body.outcomes.map((o) => ({ ref: itemsById.get(o.item_id)?.transaction_ref, outcome: o.outcome })),
        },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/schedules/${id}/outcomes` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: result })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to record the schedule's payments")
  }
}
