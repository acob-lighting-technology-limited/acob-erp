import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { notifyMdToPay } from "@/lib/requisitions/notify"
import { getViewerContext } from "@/lib/requisitions/server"
import { buildBankWorkbook, loadSchedule, scheduleAccess } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/requisitions/schedules/[id]/notify-md
 * The officer, having checked the finalized sheet, tells the MD it is ready to
 * pay. Emails the MD the bank file and notifies him in the app.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`requisition-schedule-notify-md:${getClientId(request)}`, { limit: 5, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  try {
    const viewer = await getViewerContext(admin, user.id)
    const access = await scheduleAccess(admin, viewer)
    if (!access.isOfficer) {
      return apiError("Only Payment Request officers can notify the MD.", ApiErrorCode.FORBIDDEN, 403)
    }
    const schedule = await loadSchedule(admin, id)
    if (!schedule) return apiError("Payment schedule not found", ApiErrorCode.NOT_FOUND, 404)
    if (schedule.status !== "sent") {
      return apiError("Finalize the schedule before telling the MD.", ApiErrorCode.VALIDATION_ERROR, 409)
    }
    if (!access.mdId) return apiError("No Managing Director is set up to notify.", ApiErrorCode.VALIDATION_ERROR, 409)

    const items = schedule.items || []
    const emailed = await notifyMdToPay(admin, {
      mdId: access.mdId,
      actorId: user.id,
      scheduleId: id,
      scheduleNumber: schedule.schedule_number,
      paymentDate: schedule.payment_date,
      count: items.length,
      total: items.reduce((sum, i) => sum + Number(i.amount), 0),
      fileName: `PAYMENT SCHEDULE ${schedule.schedule_number.replace(/\//g, "-")}.xlsx`,
      file: await buildBankWorkbook(schedule),
    })

    await writeAuditLog(
      supabase,
      {
        action: "send",
        entityType: "requisition_schedule",
        entityId: id,
        metadata: { event: "md_notified", emailed },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/schedules/${id}/notify-md` },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: { emailed } })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to notify the MD")
  }
}
