import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { confirmPinReset, getSigningStatus, requestPinReset } from "@/lib/approval-signing/server"
import { requireSigningUser, signingErrorResponse } from "@/lib/approval-signing/route"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const PinResetSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request") }),
  z.object({
    action: z.literal("confirm"),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code from the email."),
    pin: z.string().regex(/^\d{6}$/, "Your PIN must be exactly 6 digits."),
  }),
])

/**
 * POST /api/profile/signing/pin-reset
 *   { action: "request" }             — email a reset code to the user's own address
 *   { action: "confirm", code, pin }  — set a new PIN with that code
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`signing-pin-reset:${getClientId(request)}`, { limit: 10, windowSec: 300 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })

  const auth = await requireSigningUser()
  if ("error" in auth) return auth.error

  const parsed = PinResetSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid request", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  try {
    if (parsed.data.action === "request") {
      const { sentTo } = await requestPinReset(auth.admin, auth.user.id)
      return NextResponse.json({ data: { sent_to: sentTo } })
    }

    await confirmPinReset(auth.admin, auth.user.id, parsed.data.code, parsed.data.pin)
    await writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "approval_pin",
        entityId: auth.user.id,
        metadata: { via: "email_reset" },
        context: { actorId: auth.user.id, source: "api", route: "/api/profile/signing/pin-reset" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: await getSigningStatus(auth.admin, auth.user.id) })
  } catch (err) {
    return signingErrorResponse(err, "Failed to reset approval PIN")
  }
}
