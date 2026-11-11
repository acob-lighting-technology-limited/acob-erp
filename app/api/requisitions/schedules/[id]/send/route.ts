import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { notifyScheduleForMd } from "@/lib/requisitions/notify"
import { getViewerContext } from "@/lib/requisitions/server"
import { loadSchedule, scheduleAccess } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/** POST /api/requisitions/schedules/[id]/send — draft → sent to the MD for payment. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  try {
    const viewer = await getViewerContext(admin, user.id)
    const access = await scheduleAccess(admin, viewer)
    if (!access.isOfficer) {
      return apiError("Only Payment Request officers can send schedules.", ApiErrorCode.FORBIDDEN, 403)
    }

    const { error } = await admin.rpc("requisition_schedule_send", { p_schedule_id: id, p_actor_id: user.id })
    if (error) throw error

    const schedule = await loadSchedule(admin, id)
    const items = schedule?.items || []
    await notifyScheduleForMd(admin, {
      mdId: access.mdId,
      actorId: user.id,
      scheduleId: id,
      scheduleNumber: schedule?.schedule_number || "",
      kind: "sent",
      count: items.length,
      total: items.reduce((sum, i) => sum + Number(i.amount), 0),
    })

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
    return NextResponse.json({ data: schedule })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to send the payment schedule")
  }
}
