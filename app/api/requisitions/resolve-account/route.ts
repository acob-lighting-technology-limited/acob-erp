import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { resolveAccountName } from "@/lib/requisitions/paystack"
import { requireRequisitionUser } from "@/lib/requisitions/route-helpers"

const BodySchema = z.object({
  account_number: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  bank_code: z.string().regex(/^\d{3,6}$/, "Pick the bank"),
})

/**
 * POST /api/requisitions/resolve-account  { account_number, bank_code }
 * The account holder's name, as the bank has it. Reads a name; moves no money.
 * POST so account numbers stay out of URLs and access logs.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error

  const rl = await rateLimit(`requisition-resolve-account:${auth.user.id || getClientId(request)}`, {
    limit: 30,
    windowSec: 60,
  })
  if (!rl.allowed) return apiError("Too many lookups. Wait a minute and try again.", ApiErrorCode.RATE_LIMITED, 429)

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Check the account details", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  const result = await resolveAccountName(parsed.data.account_number, parsed.data.bank_code)
  return NextResponse.json({ data: result })
}
