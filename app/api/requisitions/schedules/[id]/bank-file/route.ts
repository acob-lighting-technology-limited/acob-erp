import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getViewerContext } from "@/lib/requisitions/server"
import { buildBankWorkbook, loadSchedule, scheduleAccess } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/** GET /api/requisitions/schedules/[id]/bank-file — the bank's bulk-upload .xlsx for this schedule. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { id } = await params
  try {
    const viewer = await getViewerContext(auth.admin, auth.user.id)
    const access = await scheduleAccess(auth.admin, viewer)
    if (!access.canView) return apiError("Payment schedule not found", ApiErrorCode.NOT_FOUND, 404)
    const schedule = await loadSchedule(auth.admin, id)
    if (!schedule) return apiError("Payment schedule not found", ApiErrorCode.NOT_FOUND, 404)
    if (!schedule.items?.length)
      return apiError("This schedule has no payments yet.", ApiErrorCode.VALIDATION_ERROR, 400)

    const buffer = await buildBankWorkbook(schedule)
    const fileName = `PAYMENT SCHEDULE ${schedule.schedule_number.replace(/\//g, "-")}.xlsx`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to build the bank file")
  }
}
