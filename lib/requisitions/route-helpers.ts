import "server-only"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { logger } from "@/lib/logger"
import { SigningError } from "@/lib/approval-signing/server"
import { signingErrorResponse } from "@/lib/approval-signing/route"
import { getRequestScope } from "@/lib/admin/api-scope"
import { canAccessAdminSection, isAdminLikeRole } from "@/lib/admin/rbac"

const log = logger("requisitions-api")

export async function requireRequisitionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401) } as const
  return { user, supabase, admin: getServiceRoleClientOrFallback(supabase) } as const
}

/** The workflow RPCs raise these codes; each maps to what the person can do about it. */
const RPC_ERRORS: Record<string, [number, string]> = {
  requisition_not_found: [404, "Requisition not found."],
  requisition_not_pending: [409, "This requisition has already moved on. Refresh to see where it is."],
  cannot_sign_own_requisition: [403, "You cannot sign your own requisition."],
  not_a_pending_signer: [403, "This requisition is not waiting on you."],
  amount_change_reason_required: [400, "Say why the amount is changing."],
  amount_change_invalid: [400, "Enter an amount greater than zero."],
  amount_change_unchanged: [400, "The new amount is the same as the current one."],
  petty_cash_limit_exceeded: [400, "Petty Cash cannot go above ₦50,000."],
  rejection_reason_required: [400, "Say why it is being rejected."],
  requisition_not_payable: [409, "This requisition is not waiting for payment."],
  cannot_process_own_requisition: [403, "You cannot record payment on your own requisition."],
  not_a_payment_processor: [403, "You are not set up to record payments."],
  payment_amount_invalid: [400, "Enter an amount greater than zero."],
  payment_exceeds_outstanding: [400, "That is more than is still owed on this requisition."],
}

export function requisitionErrorResponse(err: unknown, context: string) {
  if (err instanceof SigningError) return signingErrorResponse(err, context)
  const message = (err as { message?: string } | null)?.message || String(err)
  const known = Object.keys(RPC_ERRORS).find((code) => message.includes(code))
  if (known) {
    const [status, text] = RPC_ERRORS[known]
    return NextResponse.json(
      {
        error: text,
        code: status === 403 ? ApiErrorCode.FORBIDDEN : ApiErrorCode.VALIDATION_ERROR,
        reason: known,
      },
      { status }
    )
  }
  if ((err as { code?: string } | null)?.code === "23514") {
    log.warn({ err: message }, context)
    return apiError("That breaks one of the requisition rules.", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  log.error({ err: message }, context)
  return apiError("Something went wrong. Try again.", ApiErrorCode.INTERNAL_ERROR, 500)
}

/** Files must have been uploaded by this person, into their own folder. */
export function isOwnUploadPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes("..")
}

/** Finance admins curate requisition settings: funding categories, payment processors, stage reassignment. */
export async function canManageRequisitionSettings(): Promise<boolean> {
  const scope = await getRequestScope()
  if (!scope) return false
  return isAdminLikeRole(scope.role) && canAccessAdminSection(scope, "finance")
}
