import { NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { canManagePayees, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/** GET /api/requisitions/payees — everyone ACOB pays, with their codes. */
export async function GET() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  try {
    if (!(await canManagePayees(auth.user.id, auth.admin))) {
      return apiError("You cannot view the payee register.", ApiErrorCode.FORBIDDEN, 403)
    }
    const { data, error } = await auth.admin
      .from("requisition_payees")
      .select("*, profile:profiles!requisition_payees_profile_id_fkey(id, full_name, department, designation)")
      .order("account_name")
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load the payee register")
  }
}
