import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getMissingSetup } from "@/lib/approval-signing/server"
import { getViewerContext } from "@/lib/requisitions/server"
import { loadSchedule, scheduleAccess } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/** GET /api/requisitions/schedules/[id] — the schedule, its lines, and what the viewer may do. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { id } = await params
  try {
    const viewer = await getViewerContext(auth.admin, auth.user.id)
    const access = await scheduleAccess(auth.admin, viewer)
    if (!access.canView) return apiError("Payment schedule not found", ApiErrorCode.NOT_FOUND, 404)
    const schedule = await loadSchedule(auth.admin, id, { withReceipts: true })
    if (!schedule) return apiError("Payment schedule not found", ApiErrorCode.NOT_FOUND, 404)

    // Paid requisitions on this schedule waiting for the viewer's Approved signature.
    const reqIds = Array.from(new Set((schedule.items || []).map((i) => i.requisition_id)))
    let approvable = 0
    if (reqIds.length) {
      const { data } = await auth.admin
        .from("requisition_stages")
        .select("requisition_id, requisitions!inner(status, user_id)")
        .in("requisition_id", reqIds)
        .eq("stage_code", "approved")
        .eq("state", "pending")
        .eq("assignee_id", auth.user.id)
        .eq("requisitions.status", "awaiting_approval")
        .neq("requisitions.user_id", auth.user.id)
      approvable = (data || []).length
    }

    return NextResponse.json({
      data: schedule,
      viewer: {
        is_officer: access.isOfficer,
        is_md: access.isMd,
        approvable_count: approvable,
        signing_setup_missing:
          access.isOfficer || approvable > 0 ? await getMissingSetup(auth.admin, auth.user.id) : [],
      },
    })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load payment schedule")
  }
}
