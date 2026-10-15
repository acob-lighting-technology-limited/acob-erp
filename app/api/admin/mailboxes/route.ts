import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { CpanelError, isCpanelConfigured } from "@/lib/cpanel/client"
import { loadMailboxReport } from "@/lib/cpanel/mailboxes"
import { logger } from "@/lib/logger"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const log = logger("admin-mailboxes-api")

/**
 * GET /api/admin/mailboxes — every cPanel mailbox matched against staff
 * profiles, plus staff with no mailbox and account-wide inode usage.
 * Org-wide by nature, so admin-like only (no department scoping).
 */
export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isCpanelConfigured()) {
    return NextResponse.json({ error: "cPanel is not configured on this server" }, { status: 503 })
  }

  try {
    const report = await loadMailboxReport(getServiceRoleClientOrFallback(auth.supabase))
    return NextResponse.json({ data: report })
  } catch (err) {
    log.error({ err: String(err) }, "Failed to load mailbox report")
    const message = err instanceof CpanelError ? err.message : "Failed to load mailboxes"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
