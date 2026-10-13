import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { PaymentProcessorSchema } from "@/lib/requisitions/schemas"
import {
  canManageRequisitionSettings,
  requireRequisitionUser,
  requisitionErrorResponse,
} from "@/lib/requisitions/route-helpers"

/**
 * Staff who record payments on fully signed requisitions. The Accounts lead is
 * always allowed as well and is not listed here.
 *   GET     list
 *   POST    { profile_id }   add (finance admins)
 *   DELETE  ?profile_id=     remove (finance admins)
 */
export async function GET() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  try {
    const { data, error } = await auth.admin
      .from("requisition_payment_processors")
      .select(
        "profile_id, created_at, person:profiles!requisition_payment_processors_profile_id_fkey(id, full_name, department, designation)"
      )
      .order("created_at")
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to list payment processors")
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  if (!(await canManageRequisitionSettings())) {
    return apiError("Only finance admins can change payment processors.", ApiErrorCode.FORBIDDEN, 403)
  }
  const parsed = PaymentProcessorSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid request", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  try {
    const { error } = await auth.admin
      .from("requisition_payment_processors")
      .upsert({ profile_id: parsed.data.profile_id, added_by: auth.user.id }, { onConflict: "profile_id" })
    if (error) throw error
    await writeAuditLog(
      auth.supabase,
      {
        action: "assign",
        entityType: "requisition_payment_processor",
        entityId: parsed.data.profile_id,
        context: { actorId: auth.user.id, source: "api", route: "/api/requisitions/payment-processors" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to add payment processor")
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  if (!(await canManageRequisitionSettings())) {
    return apiError("Only finance admins can change payment processors.", ApiErrorCode.FORBIDDEN, 403)
  }
  const parsed = PaymentProcessorSchema.safeParse({
    profile_id: new URL(request.url).searchParams.get("profile_id"),
  })
  if (!parsed.success) return apiError("Pick someone to remove", ApiErrorCode.VALIDATION_ERROR, 400)
  try {
    const { error } = await auth.admin
      .from("requisition_payment_processors")
      .delete()
      .eq("profile_id", parsed.data.profile_id)
    if (error) throw error
    await writeAuditLog(
      auth.supabase,
      {
        action: "unassign",
        entityType: "requisition_payment_processor",
        entityId: parsed.data.profile_id,
        context: { actorId: auth.user.id, source: "api", route: "/api/requisitions/payment-processors" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to remove payment processor")
  }
}
