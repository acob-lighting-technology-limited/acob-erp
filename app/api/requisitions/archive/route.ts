import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getViewerContext } from "@/lib/requisitions/server"
import { requireRequisitionUser } from "@/lib/requisitions/route-helpers"
import { archiveRequisitionToSharePoint, sweepPaidRequisitionsForArchive } from "@/lib/requisitions/archive"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/requisitions/archive
 * Admin-only: archives unarchived attachments for paid requisitions to SharePoint.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`requisition-archive:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin } = auth

  const viewer = await getViewerContext(admin, user.id)
  if (!viewer.isAdminLike) {
    return apiError("Only administrators can trigger archive sweeps.", ApiErrorCode.FORBIDDEN, 403)
  }

  const body = await request.json().catch(() => ({}))
  const requisitionId = typeof body?.requisition_id === "string" ? body.requisition_id.trim() : null

  if (requisitionId) {
    const result = await archiveRequisitionToSharePoint(admin, requisitionId)
    return NextResponse.json({ data: result })
  }

  const sweepResult = await sweepPaidRequisitionsForArchive(admin, 20)
  return NextResponse.json({ data: sweepResult })
}
