import { NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getViewerContext } from "@/lib/requisitions/server"
import { loadSchedulableLines } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/** GET /api/requisitions/schedules/pool — verified Payment Request lines ready to go on a schedule. */
export async function GET() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  try {
    const viewer = await getViewerContext(auth.admin, auth.user.id)
    if (!viewer.paymentFormTypes.includes("payment_request")) {
      return apiError("Only Payment Request officers can build schedules.", ApiErrorCode.FORBIDDEN, 403)
    }
    const lines = await loadSchedulableLines(auth.admin)
    // An officer never pays their own requisition.
    const { data: own } = await auth.admin.from("requisitions").select("id").eq("user_id", auth.user.id)
    const ownIds = new Set((own || []).map((r) => r.id as string))
    return NextResponse.json({ data: lines.filter((l) => !ownIds.has(l.requisition_id)) })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load payable requisitions")
  }
}
