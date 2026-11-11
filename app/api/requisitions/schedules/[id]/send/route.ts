import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { emailScheduleSheetToOfficer } from "@/lib/requisitions/notify"
import { getViewerContext } from "@/lib/requisitions/server"
import { buildBankWorkbook, loadSchedule, scheduleAccess } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/**
 * POST /api/requisitions/schedules/[id]/send — finalize a draft schedule.
 * Locks its lines and emails the bank file to the officer to check. The MD is
 * not contacted: the officer passes the sheet on once he is happy with it.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  try {
    const viewer = await getViewerContext(admin, user.id)
    const access = await scheduleAccess(admin, viewer)
    if (!access.isOfficer) {
      return apiError("Only Payment Request officers can finalize schedules.", ApiErrorCode.FORBIDDEN, 403)
    }

    const { error } = await admin.rpc("requisition_schedule_send", { p_schedule_id: id, p_actor_id: user.id })
    if (error) throw error

    const schedule = await loadSchedule(admin, id)
    const items = schedule?.items || []
    let emailed = false
    if (schedule) {
      emailed = await emailScheduleSheetToOfficer(admin, {
        officerId: user.id,
        scheduleId: id,
        scheduleNumber: schedule.schedule_number,
        paymentDate: schedule.payment_date,
        count: items.length,
        total: items.reduce((sum, i) => sum + Number(i.amount), 0),
        fileName: `PAYMENT SCHEDULE ${schedule.schedule_number.replace(/\//g, "-")}.xlsx`,
        file: await buildBankWorkbook(schedule),
      })
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition_schedule",
        entityId: id,
        oldValues: { status: "draft" },
        newValues: { status: "sent" },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/schedules/${id}/send` },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: schedule, emailed })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to finalize the payment schedule")
  }
}
