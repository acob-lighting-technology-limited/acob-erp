import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { RequisitionSettingsSchema } from "@/lib/requisitions/schemas"
import { readSetting } from "@/lib/requisitions/schedules"
import {
  canManageRequisitionSettings,
  requireRequisitionUser,
  requisitionErrorResponse,
} from "@/lib/requisitions/route-helpers"

/** GET/PUT /api/requisitions/settings — the account the bank debits for payment schedules. */
export async function GET() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  if (!(await canManageRequisitionSettings())) {
    return apiError("Only finance admins can view requisition settings.", ApiErrorCode.FORBIDDEN, 403)
  }
  try {
    return NextResponse.json({ data: { bank_debit_account: await readSetting(auth.admin, "bank_debit_account") } })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load requisition settings")
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  if (!(await canManageRequisitionSettings())) {
    return apiError("Only finance admins can change requisition settings.", ApiErrorCode.FORBIDDEN, 403)
  }
  const parsed = RequisitionSettingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid settings", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  try {
    const before = await readSetting(auth.admin, "bank_debit_account")
    const { error } = await auth.admin.from("requisition_settings").upsert({
      key: "bank_debit_account",
      value: parsed.data.bank_debit_account,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    await writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "requisition_settings",
        entityId: "bank_debit_account",
        oldValues: { bank_debit_account: before },
        newValues: { bank_debit_account: parsed.data.bank_debit_account },
        context: { actorId: auth.user.id, source: "api", route: "/api/requisitions/settings" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: parsed.data })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to save requisition settings")
  }
}
