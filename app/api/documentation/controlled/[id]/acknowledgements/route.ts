import { NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { normalizeDepartmentName } from "@/shared/departments"
import { beginControlledDocRequest, loadControlledDoc } from "@/lib/documentation/controlled-api"
import { loadAcknowledgementStaff } from "@/lib/documentation/controlled-server"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * GET — who has and hasn't acknowledged a policy's current version. Limited
 * to the request's admin scope, so a department console lists only that
 * department's staff.
 */
export async function GET(request: Request, { params }: Params) {
  const begin = await beginControlledDocRequest(request, "acknowledgements")
  if (!begin.ok) return begin.response
  const { db } = begin.ctx
  const { id } = await params

  const scope = await getRequestScope()
  if (!scope) return apiError("Forbidden", ApiErrorCode.FORBIDDEN, 403)
  const scopedDepartments = getScopedDepartments(scope)

  const doc = await loadControlledDoc(db, id)
  if (!doc || doc.doc_type !== "policy" || doc.status !== "published") {
    return apiError("Published policy not found", ApiErrorCode.NOT_FOUND, 404)
  }

  const departments = scopedDepartments === null ? null : scope.managedDepartments.map(normalizeDepartmentName)
  const data = await loadAcknowledgementStaff(db, doc, departments)
  return NextResponse.json({ data })
}
