import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { CpanelError, isCpanelConfigured, setMailboxPassword, getMailbox } from "@/lib/cpanel/client"
import { logger } from "@/lib/logger"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"
import { getClientId, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const log = logger("admin-mailbox-password-api")

const PasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .refine((e) => e.endsWith(`@${ORG_STAFF_DOMAIN.toLowerCase()}`), `Mailbox must be on @${ORG_STAFF_DOMAIN}`),
  password: z.string().min(8, "Password must be at least 8 characters long").max(128, "Password too long"),
})

/**
 * POST /api/admin/mailboxes/password — reset a mailbox's password on cPanel.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-mailbox-password:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 })
  }

  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isCpanelConfigured()) {
    return NextResponse.json({ error: "cPanel is not configured on this server" }, { status: 503 })
  }

  const json = await request.json().catch(() => null)
  const parsed = PasswordSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
  }

  const { email, password } = parsed.data

  try {
    const existing = await getMailbox(email)
    if (!existing) {
      return NextResponse.json({ error: `Mailbox ${email} does not exist on cPanel` }, { status: 404 })
    }

    await setMailboxPassword(email, password)

    await writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "mailbox_password",
        entityId: email,
        newValues: { email, reset_at: new Date().toISOString() },
        context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/mailboxes/password" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: { email, success: true } })
  } catch (err) {
    log.error({ err: String(err), email }, "Failed to reset mailbox password")
    const message = err instanceof CpanelError ? err.message : "Failed to reset password on cPanel"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
