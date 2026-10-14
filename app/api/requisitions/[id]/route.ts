import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import {
  canViewRequisition,
  getViewerActions,
  getViewerContext,
  loadRequisition,
  withSignedUrls,
} from "@/lib/requisitions/server"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/** GET /api/requisitions/[id] — the requisition, its history, and what the viewer may do. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin } = auth
  const { id } = await params

  try {
    const [req, viewer] = await Promise.all([loadRequisition(admin, id), getViewerContext(admin, user.id)])
    // Same answer for "missing" and "not yours", so ids cannot be probed.
    if (!req || !canViewRequisition(req, viewer)) {
      return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)
    }

    return NextResponse.json({
      data: await withSignedUrls(admin, req),
      viewer: {
        ...(await getViewerActions(admin, req, viewer)),
        is_admin: viewer.isAdminLike,
      },
    })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load requisition")
  }
}
