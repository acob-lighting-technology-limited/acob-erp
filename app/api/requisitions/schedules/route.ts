import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { CreateScheduleSchema } from "@/lib/requisitions/schemas"
import { getViewerContext } from "@/lib/requisitions/server"
import { listSchedules, readSetting, scheduleAccess } from "@/lib/requisitions/schedules"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * Payment schedules: Payment Requests paid in a batch through the bank.
 *   GET   list (Payment Request officers, the MD, admins)
 *   POST  { payment_date, note? } start a draft (Payment Request officers)
 */
export async function GET() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  try {
    const viewer = await getViewerContext(auth.admin, auth.user.id)
    const access = await scheduleAccess(auth.admin, viewer)
    if (!access.canView) return apiError("You cannot view payment schedules.", ApiErrorCode.FORBIDDEN, 403)
    return NextResponse.json({
      data: await listSchedules(auth.admin),
      viewer: { is_officer: access.isOfficer, is_md: access.isMd },
    })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to list payment schedules")
  }
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`requisition-schedule:${getClientId(request)}`, { limit: 20, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth

  const parsed = CreateScheduleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid schedule", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  try {
    const viewer = await getViewerContext(admin, user.id)
    if (!viewer.paymentFormTypes.includes("payment_request")) {
      return apiError("Only Payment Request officers can start a schedule.", ApiErrorCode.FORBIDDEN, 403)
    }
    const debitAccount = await readSetting(admin, "bank_debit_account")
    if (!debitAccount) {
      return apiError(
        "Set the account the bank debits in Requisition settings first.",
        ApiErrorCode.VALIDATION_ERROR,
        400
      )
    }

    const { data, error } = await admin.rpc("requisition_schedule_create", {
      p_actor_id: user.id,
      p_payment_date: parsed.data.payment_date,
      p_debit_account: debitAccount,
      p_note: parsed.data.note || null,
    })
    if (error) throw error
    const schedule = data as { id: string; schedule_number: string }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "requisition_schedule",
        entityId: schedule.id,
        newValues: { schedule_number: schedule.schedule_number, payment_date: parsed.data.payment_date },
        context: { actorId: user.id, source: "api", route: "/api/requisitions/schedules" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: schedule }, { status: 201 })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to start a payment schedule")
  }
}
