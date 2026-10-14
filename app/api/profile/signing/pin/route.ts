import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSigningStatus, setPin } from "@/lib/approval-signing/server"
import { requireSigningUser, signingErrorResponse } from "@/lib/approval-signing/route"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const SetPinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, "Your PIN must be exactly 6 digits."),
  current_pin: z
    .string()
    .regex(/^\d{6}$/, "Enter your current 6-digit PIN.")
    .optional(),
})

/** POST /api/profile/signing/pin — create the approval PIN, or change it with the current one. */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`signing-pin:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })

  const auth = await requireSigningUser()
  if ("error" in auth) return auth.error

  const parsed = SetPinSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid PIN", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  try {
    await setPin(auth.admin, auth.user.id, parsed.data.pin, parsed.data.current_pin)
    await writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "approval_pin",
        entityId: auth.user.id,
        context: { actorId: auth.user.id, source: "api", route: "/api/profile/signing/pin" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: await getSigningStatus(auth.admin, auth.user.id) })
  } catch (err) {
    return signingErrorResponse(err, "Failed to set approval PIN")
  }
}
