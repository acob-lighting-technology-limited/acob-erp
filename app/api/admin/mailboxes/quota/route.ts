import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { CpanelError, getMailbox, isCpanelConfigured, setMailboxQuota } from "@/lib/cpanel/client"
import { MAILBOX_QUOTA_STEPS_MB } from "@/lib/cpanel/quota"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const log = logger("admin-mailbox-quota-api")

const QuotaSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid mailbox address"),
  quotaMb: z.coerce
    .number()
    .int()
    .refine((v) => (MAILBOX_QUOTA_STEPS_MB as readonly number[]).includes(v), "Pick one of the offered quota sizes"),
})

/** PATCH /api/admin/mailboxes/quota — change one mailbox's quota on cPanel. */
export async function PATCH(request: NextRequest) {
  const rl = await rateLimit(`admin-mailbox-quota:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isCpanelConfigured()) {
    return NextResponse.json({ error: "cPanel is not configured on this server" }, { status: 503 })
  }

  const parsed = QuotaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const { email, quotaMb } = parsed.data

  try {
    const before = await getMailbox(email)
    if (!before) return NextResponse.json({ error: "That mailbox does not exist on cPanel" }, { status: 404 })

    await setMailboxQuota(email, quotaMb)
    const after = await getMailbox(email)

    await writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "mailbox",
        entityId: email,
        oldValues: { quota_bytes: before.quotaBytes },
        newValues: { quota_bytes: after?.quotaBytes ?? quotaMb * 1024 * 1024 },
        context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/mailboxes/quota" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: after })
  } catch (err) {
    log.error({ err: String(err), email }, "Failed to change mailbox quota")
    const message = err instanceof CpanelError ? err.message : "Failed to change the quota"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
