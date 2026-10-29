import { NextRequest, NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { formatBytes } from "@/lib/cpanel/quota"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export type MailboxHistoryActionType = "create" | "password_reset" | "quota_changed" | "suspension_changed" | "other"

export interface MailboxHistoryItem {
  id: string
  createdAt: string
  email: string
  actionType: MailboxHistoryActionType
  title: string
  description: string
  actor: {
    id: string | null
    name: string
    email: string | null
  }
  metadata: {
    ipAddress?: string | null
    route?: string | null
  }
}

interface AuditLogRecord {
  id: string
  created_at: string
  action: string | null
  operation: string | null
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  user_id: string | null
}

function classifyAuditEntry(row: AuditLogRecord): {
  isCpanel: boolean
  actionType: MailboxHistoryActionType
  title: string
  description: string
} {
  const route = typeof row.metadata?.route === "string" ? row.metadata.route : ""
  const action = (row.action || row.operation || "").toLowerCase()
  const newVals = row.new_values ?? {}
  const oldVals = row.old_values ?? {}

  // Explicitly ignore internal Matrix-only link changes
  if (route === "/api/admin/mailboxes/link") {
    return { isCpanel: false, actionType: "other", title: "", description: "" }
  }

  // Password reset on cPanel
  if (row.entity_type === "mailbox_password" || route === "/api/admin/mailboxes/password" || "reset_at" in newVals) {
    return {
      isCpanel: true,
      actionType: "password_reset",
      title: "Password reset",
      description: "Mailbox password was reset on cPanel.",
    }
  }

  // Mailbox creation
  if (action === "create" || route === "/api/admin/mailboxes") {
    const quotaDesc = newVals.quota_gb
      ? `${newVals.quota_gb} GB`
      : newVals.quota_mb
        ? `${newVals.quota_mb} MB`
        : "standard"
    return {
      isCpanel: true,
      actionType: "create",
      title: "Mailbox created",
      description: `Mailbox was created on cPanel with ${quotaDesc} quota.`,
    }
  }

  // Quota change
  if (route === "/api/admin/mailboxes/quota" || "quota_bytes" in newVals || "quota_bytes" in oldVals) {
    const oldBytes = typeof oldVals.quota_bytes === "number" ? oldVals.quota_bytes : null
    const newBytes = typeof newVals.quota_bytes === "number" ? newVals.quota_bytes : null
    let desc = "Mailbox storage quota was updated on cPanel."
    if (oldBytes != null && newBytes != null) {
      desc = `Quota changed from ${formatBytes(oldBytes)} to ${formatBytes(newBytes)}.`
    } else if (newBytes != null) {
      desc = `Quota set to ${formatBytes(newBytes)}.`
    }
    return {
      isCpanel: true,
      actionType: "quota_changed",
      title: "Quota updated",
      description: desc,
    }
  }

  // Suspension change
  if (
    route === "/api/admin/mailboxes/suspension" ||
    "suspended_login" in newVals ||
    "suspended_incoming" in newVals ||
    "applied" in newVals
  ) {
    const applied = Array.isArray(newVals.applied) ? (newVals.applied as string[]) : []
    const isLoginSuspended = Boolean(newVals.suspended_login)
    const isIncomingSuspended = Boolean(newVals.suspended_incoming)

    let title = "Mailbox suspension updated"
    let desc = "Suspension status changed on cPanel."

    if (applied.length > 0) {
      const parts: string[] = []
      if (applied.includes("suspend_login")) parts.push("Login suspended")
      if (applied.includes("unsuspend_login")) parts.push("Login restored")
      if (applied.includes("suspend_incoming")) parts.push("Incoming suspended")
      if (applied.includes("unsuspend_incoming")) parts.push("Incoming restored")
      title = parts[0] ?? title
      desc = parts.join(", ") + " on cPanel."
    } else if (isLoginSuspended && isIncomingSuspended) {
      title = "Login & incoming suspended"
      desc = "Both login access and incoming mail suspended on cPanel."
    } else if (isLoginSuspended) {
      title = "Login suspended"
      desc = "Login access suspended on cPanel."
    } else {
      title = "Mailbox restored"
      desc = "Suspensions lifted on cPanel."
    }

    return {
      isCpanel: true,
      actionType: "suspension_changed",
      title,
      description: desc,
    }
  }

  // Offboarding / rename / other cPanel operations
  if (Array.isArray(newVals.done) && newVals.done.length > 0) {
    return {
      isCpanel: true,
      actionType: "other",
      title: "Mailbox offboarding action",
      description: `Applied actions: ${(newVals.done as string[]).join(", ")}.`,
    }
  }

  // If new_values is purely link_type / project_id / profile_id, ignore
  if ("link_type" in newVals || "project_id" in newVals || "profile_id" in newVals) {
    return { isCpanel: false, actionType: "other", title: "", description: "" }
  }

  return { isCpanel: false, actionType: "other", title: "", description: "" }
}

/**
 * GET /api/admin/mailboxes/history
 * Returns audit trail of actions executed on cPanel (creations, password resets, quota changes, suspensions).
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`admin-mailbox-history:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 })
  }

  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const serviceClient = getServiceRoleClientOrFallback(auth.supabase)

  const { data: rawLogs, error: logErr } = await serviceClient
    .from("audit_logs")
    .select("id, created_at, action, operation, entity_type, entity_id, old_values, new_values, metadata, user_id")
    .in("entity_type", ["mailbox", "mailbox_password"])
    .order("created_at", { ascending: false })
    .limit(100)

  if (logErr) {
    return NextResponse.json({ error: "Failed to load mailbox history" }, { status: 500 })
  }

  const validEntries: {
    row: AuditLogRecord
    actionType: MailboxHistoryActionType
    title: string
    description: string
  }[] = []

  for (const row of (rawLogs ?? []) as AuditLogRecord[]) {
    const classification = classifyAuditEntry(row)
    if (classification.isCpanel) {
      validEntries.push({
        row,
        actionType: classification.actionType,
        title: classification.title,
        description: classification.description,
      })
    }
  }

  // Collect user IDs to resolve actor details from profiles and auth
  const userIds = Array.from(new Set(validEntries.map((e) => e.row.user_id).filter(Boolean) as string[]))
  const profileMap = new Map<string, { name: string; email: string | null }>()

  if (userIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, full_name, first_name, last_name, company_email")
      .in("id", userIds)

    for (const p of profiles ?? []) {
      const name = p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Admin"
      profileMap.set(p.id, { name, email: p.company_email })
    }

    // For any user IDs not found in profiles, check auth.users
    const missingUserIds = userIds.filter((id) => !profileMap.has(id))
    for (const id of missingUserIds) {
      try {
        const { data: authUser } = await serviceClient.auth.admin.getUserById(id)
        if (authUser?.user) {
          const email = authUser.user.email ?? null
          profileMap.set(id, { name: email ? email.split("@")[0] : "Admin", email })
        }
      } catch {
        // Fallback to generic Admin
        profileMap.set(id, { name: "Admin", email: null })
      }
    }
  }

  const items: MailboxHistoryItem[] = validEntries.map(({ row, actionType, title, description }) => {
    const actorInfo = row.user_id ? profileMap.get(row.user_id) : null
    const actorName = actorInfo?.name || (row.user_id ? "Admin" : "System")
    const actorEmail = actorInfo?.email || null

    const metadataIp = typeof row.metadata?.ip_address === "string" ? row.metadata.ip_address : null
    const metadataRoute = typeof row.metadata?.route === "string" ? row.metadata.route : null

    return {
      id: row.id,
      createdAt: row.created_at,
      email: row.entity_id,
      actionType,
      title,
      description,
      actor: {
        id: row.user_id,
        name: actorName,
        email: actorEmail,
      },
      metadata: {
        ipAddress: metadataIp,
        route: metadataRoute,
      },
    }
  })

  return NextResponse.json({ data: items })
}
