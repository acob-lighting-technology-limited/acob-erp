import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import {
  CpanelError,
  getMailbox,
  isCpanelConfigured,
  setMailboxIncomingSuspended,
  setMailboxLoginSuspended,
} from "@/lib/cpanel/client"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const log = logger("admin-mailbox-suspension-api")

const SuspensionSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid mailbox address"),
  /** suspend: block login (and optionally incoming). restore: lift both. */
  action: z.enum(["suspend", "restore"]),
  /** With "suspend": also bounce mail sent to the mailbox. */
  rejectIncoming: z.boolean().optional().default(false),
})

/** PATCH /api/admin/mailboxes/suspension — suspend or restore one mailbox on cPanel. */
export async function PATCH(request: NextRequest) {
  const rl = await rateLimit(`admin-mailbox-suspension:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isCpanelConfigured()) {
    return NextResponse.json({ error: "cPanel is not configured on this server" }, { status: 503 })
  }

  const parsed = SuspensionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const { email, action, rejectIncoming } = parsed.data

  // Each cPanel call is recorded as it lands, so a failure part-way through
  // still leaves an audit trail of what did change.
  const applied: string[] = []
  let before: Awaited<ReturnType<typeof getMailbox>> = null
  const audit = (newValues: Record<string, unknown>) =>
    writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "mailbox",
        entityId: email,
        oldValues: before
          ? { suspended_login: before.suspendedLogin, suspended_incoming: before.suspendedIncoming }
          : null,
        newValues: { ...newValues, applied },
        context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/mailboxes/suspension" },
      },
      { failOpen: true }
    )

  try {
    before = await getMailbox(email)
    if (!before) return NextResponse.json({ error: "That mailbox does not exist on cPanel" }, { status: 404 })

    if (action === "suspend") {
      if (!before.suspendedLogin) {
        await setMailboxLoginSuspended(email, true)
        applied.push("suspend_login")
      }
      if (rejectIncoming && !before.suspendedIncoming) {
        await setMailboxIncomingSuspended(email, true)
        applied.push("suspend_incoming")
      }
    } else {
      if (before.suspendedLogin) {
        await setMailboxLoginSuspended(email, false)
        applied.push("unsuspend_login")
      }
      if (before.suspendedIncoming) {
        await setMailboxIncomingSuspended(email, false)
        applied.push("unsuspend_incoming")
      }
    }
    const after = await getMailbox(email)

    await audit({ suspended_login: after?.suspendedLogin, suspended_incoming: after?.suspendedIncoming })

    return NextResponse.json({ data: after })
  } catch (err) {
    log.error({ err: String(err), email, action, applied }, "Failed to change mailbox suspension")
    const message = err instanceof CpanelError ? err.message : "Failed to update the mailbox"
    if (applied.length > 0) await audit({ partial: true, error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
