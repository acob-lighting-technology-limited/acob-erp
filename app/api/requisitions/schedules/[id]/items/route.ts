import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { bankCodeForName, bankNameForCode } from "@/lib/requisitions/bank-file"
import { AddScheduleItemsSchema } from "@/lib/requisitions/schemas"
import { getViewerContext } from "@/lib/requisitions/server"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import type { BeneficiaryDetail } from "@/lib/requisitions/types"
import { getClientId, rateLimit } from "@/lib/rate-limit"

async function requireOfficer() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth
  const viewer = await getViewerContext(auth.admin, auth.user.id)
  if (!viewer.paymentFormTypes.includes("payment_request")) {
    return { error: apiError("Only Payment Request officers can change schedules.", ApiErrorCode.FORBIDDEN, 403) }
  }
  return auth
}

/**
 * POST /api/requisitions/schedules/[id]/items  { lines: [{ requisition_id, beneficiary_index, amount, bank_code? }] }
 * Each line's account goes into the payee register (or is found there), and
 * its code becomes the bank file's Beneficiary Code.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`requisition-schedule-items:${getClientId(request)}`, { limit: 40, windowSec: 300 })
  if (!rl.allowed) return apiError("Too many requests. Try again shortly.", ApiErrorCode.RATE_LIMITED, 429)

  const auth = await requireOfficer()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  const parsed = AddScheduleItemsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid lines", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  try {
    const reqIds = Array.from(new Set(parsed.data.lines.map((l) => l.requisition_id)))
    const { data: reqs, error } = await admin
      .from("requisitions")
      .select("id, requisition_number, beneficiary_details")
      .in("id", reqIds)
    if (error) throw error
    const byId = new Map((reqs || []).map((r) => [r.id as string, r]))

    const added: string[] = []
    for (const line of parsed.data.lines) {
      const req = byId.get(line.requisition_id)
      if (!req) return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)
      const beneficiary = (req.beneficiary_details as BeneficiaryDetail[])[line.beneficiary_index]
      if (!beneficiary) return apiError("That beneficiary line does not exist.", ApiErrorCode.VALIDATION_ERROR, 400)

      const bankCode = beneficiary.bank_code || line.bank_code || bankCodeForName(beneficiary.bank_name)
      if (!bankCode) {
        return apiError(
          `Pick the bank for ${beneficiary.account_name} on ${req.requisition_number}.`,
          ApiErrorCode.VALIDATION_ERROR,
          400
        )
      }
      const accountNumber = String(beneficiary.account_number).replace(/\D/g, "")
      if (accountNumber.length !== 10) {
        return apiError(
          `${beneficiary.account_name}'s account number on ${req.requisition_number} is not 10 digits.`,
          ApiErrorCode.VALIDATION_ERROR,
          400
        )
      }

      const { data: payee, error: payeeError } = await admin.rpc("requisition_payee_upsert", {
        p_account_number: accountNumber,
        p_bank_code: bankCode,
        p_bank_name: bankNameForCode(bankCode) || beneficiary.bank_name,
        p_account_name: beneficiary.verified_account_name || beneficiary.account_name,
        p_actor_id: user.id,
      })
      if (payeeError) throw payeeError

      const { data: item, error: itemError } = await admin.rpc("requisition_schedule_add_item", {
        p_schedule_id: id,
        p_actor_id: user.id,
        p_requisition_id: line.requisition_id,
        p_beneficiary_index: line.beneficiary_index,
        p_amount: line.amount,
        p_payee_id: (payee as { id: string }).id,
      })
      if (itemError) throw itemError
      added.push((item as { transaction_ref: string }).transaction_ref)
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition_schedule",
        entityId: id,
        newValues: { added },
        metadata: { event: "schedule_lines_added" },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/schedules/${id}/items` },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: { added } })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to add to the payment schedule")
  }
}

/** DELETE /api/requisitions/schedules/[id]/items?item_id= — take a line off a draft schedule. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficer()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id } = await params

  const itemId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("item_id"))
  if (!itemId.success) return apiError("Pick a line to remove", ApiErrorCode.VALIDATION_ERROR, 400)

  try {
    const { data: item } = await admin
      .from("requisition_schedule_items")
      .select("id, schedule_id, transaction_ref")
      .eq("id", itemId.data)
      .eq("schedule_id", id)
      .maybeSingle()
    if (!item) return apiError("Line not found", ApiErrorCode.NOT_FOUND, 404)

    const { error } = await admin.rpc("requisition_schedule_remove_item", {
      p_item_id: itemId.data,
      p_actor_id: user.id,
    })
    if (error) throw error

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition_schedule",
        entityId: id,
        oldValues: { line: item.transaction_ref },
        metadata: { event: "schedule_line_removed" },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/schedules/${id}/items` },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: { removed: item.transaction_ref } })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to remove the line")
  }
}
