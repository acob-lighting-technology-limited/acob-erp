import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { UpdatePayeeSchema } from "@/lib/requisitions/schemas"
import { canManagePayees, requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/**
 * PATCH /api/requisitions/payees/[id] { code?, profile_id?, rc_number?, notes? }
 * Linking a staff member makes the payee "staff" and, unless a code is given,
 * uses their employee number as the code. Past schedules keep the code they used.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  const parsed = UpdatePayeeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid payee", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  const body = parsed.data

  try {
    if (!(await canManagePayees(user.id, admin))) {
      return apiError("You cannot change the payee register.", ApiErrorCode.FORBIDDEN, 403)
    }
    const { data: before } = await admin
      .from("requisition_payees")
      .select("id, code, kind, profile_id, rc_number")
      .eq("id", id)
      .maybeSingle()
    if (!before) return apiError("Payee not found", ApiErrorCode.NOT_FOUND, 404)

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.rc_number !== undefined) update.rc_number = body.rc_number || null
    if (body.notes !== undefined) update.notes = body.notes || null
    if (body.profile_id !== undefined) {
      update.profile_id = body.profile_id
      update.kind = body.profile_id ? "staff" : "vendor"
      if (body.profile_id && body.code === undefined) {
        const { data: person } = await admin
          .from("profiles")
          .select("employee_number")
          .eq("id", body.profile_id)
          .maybeSingle<{ employee_number: string | null }>()
        const staffCode = person?.employee_number?.replace(/[,;' ]/g, "").trim()
        if (staffCode && staffCode.length <= 35) update.code = staffCode
      }
    }
    if (body.code !== undefined) update.code = body.code

    if (update.code && update.code !== before.code) {
      const { data: taken } = await admin
        .from("requisition_payees")
        .select("id, account_name")
        .eq("code", update.code as string)
        .neq("id", id)
        .maybeSingle()
      if (taken) {
        return apiError(`${update.code} is already ${taken.account_name}'s code.`, ApiErrorCode.VALIDATION_ERROR, 409)
      }
    }

    const { data, error } = await admin.from("requisition_payees").update(update).eq("id", id).select().single()
    if (error) throw error

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition_payee",
        entityId: id,
        oldValues: { code: before.code, kind: before.kind, profile_id: before.profile_id, rc_number: before.rc_number },
        newValues: { code: data.code, kind: data.kind, profile_id: data.profile_id, rc_number: data.rc_number },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/payees/${id}` },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to update the payee")
  }
}
