import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { verifyActionPin } from "@/lib/approval-signing/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { archiveRequisitionToSharePoint } from "@/lib/requisitions/archive"
import { notifyRequisitionEvent } from "@/lib/requisitions/notify"
import { ApproveScheduleSchema } from "@/lib/requisitions/schemas"
import { findSignableStage, loadRequisition } from "@/lib/requisitions/server"
import { loadSchedule } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const log = logger("requisition-schedule-approve")

/**
 * POST /api/requisitions/schedules/[id]/approve { pin, comments? }
 * The MD signs Approved on every requisition on this schedule that has been
 * paid in full and is waiting for him: one PIN, each form still gets his
 * signature. Requisitions he cannot sign are left as they are.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`requisition-schedule-approve:${getClientId(request)}`, { limit: 10, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  const parsed = ApproveScheduleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid request", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  try {
    const schedule = await loadSchedule(admin, id)
    if (!schedule) return apiError("Payment schedule not found", ApiErrorCode.NOT_FOUND, 404)

    const reqIds = Array.from(new Set((schedule.items || []).map((i) => i.requisition_id)))
    const reqs = (await Promise.all(reqIds.map((reqId) => loadRequisition(admin, reqId)))).filter(
      (r): r is NonNullable<typeof r> => Boolean(r && r.status === "awaiting_approval" && findSignableStage(r, user.id))
    )
    if (!reqs.length) {
      return apiError("Nothing on this schedule is waiting for your approval.", ApiErrorCode.VALIDATION_ERROR, 409)
    }

    const signaturePath = await verifyActionPin(admin, user.id, parsed.data.pin)

    const approved: string[] = []
    for (const req of reqs) {
      const { error } = await admin.rpc("requisition_sign", {
        p_requisition_id: req.id,
        p_actor_id: user.id,
        p_comments: parsed.data.comments || null,
        p_signature_path: signaturePath,
        p_amount_change: null,
      })
      if (error) {
        log.warn({ err: error.message, requisition: req.id }, "Could not approve a scheduled requisition")
        continue
      }
      approved.push(req.requisition_number)
      const updated = await loadRequisition(admin, req.id)
      if (updated) {
        await notifyRequisitionEvent(admin, {
          kind: "signed",
          req: updated,
          actorId: user.id,
          bypassedStageIds: [],
          amountChanged: false,
        })
        if (updated.status === "paid") {
          archiveRequisitionToSharePoint(admin, req.id).catch((err) => {
            log.error("Failed to archive approved requisition to SharePoint", { id: req.id, err })
          })
        }
      }
    }

    await writeAuditLog(
      supabase,
      {
        action: "approve",
        entityType: "requisition_schedule",
        entityId: id,
        newValues: { approved },
        metadata: { event: "schedule_approved" },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/schedules/${id}/approve` },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: { approved } })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to approve the schedule")
  }
}
