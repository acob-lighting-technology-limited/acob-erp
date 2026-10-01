import { formatName } from "@/lib/utils"
import type { RecentActivityItem } from "./dashboard-types"
import {
  activityModuleNoun,
  activitySentenceCase,
  asPredicate,
  describeActivityFeed,
  normalizeToken,
  type DescribableAuditRow,
} from "@/lib/audit/describe-activity"

export { normalizeToken }

export type AdminDomain = "hr" | "finance" | "assets" | "reports" | "tasks" | "communications"
export const ADMIN_DOMAINS: AdminDomain[] = ["hr", "finance", "assets", "reports", "tasks", "communications"]

export function normalizeAdminDomains(domains: string[] | null | undefined): AdminDomain[] {
  if (!Array.isArray(domains)) return []
  return Array.from(
    new Set(
      domains
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
  ).filter((value): value is AdminDomain => ADMIN_DOMAINS.includes(value as AdminDomain))
}

export function getDomainForAdminPath(path: string): AdminDomain | null {
  if (path.startsWith("/admin/hr")) return "hr"
  if (path.startsWith("/admin/accounts") || path.startsWith("/admin/finance") || path.startsWith("/admin/purchasing"))
    return "finance"
  if (path.startsWith("/admin/assets") || path.startsWith("/admin/inventory")) return "assets"
  if (path.startsWith("/admin/reports") || path.startsWith("/admin/audit-logs")) return "reports"
  if (path.startsWith("/admin/tasks")) return "tasks"
  if (
    path.startsWith("/admin/documentation") ||
    path.startsWith("/admin/feedback") ||
    path.startsWith("/admin/notifications") ||
    path.startsWith("/admin/communications") ||
    path.startsWith("/admin/correspondence") ||
    path.startsWith("/admin/tools") ||
    path.startsWith("/admin/help-desk")
  ) {
    return "communications"
  }
  return null
}

export function isExcludedActivity(
  item?: {
    action?: string | null
    operation?: string | null
    entity_type?: string | null
    table_name?: string | null
  } | null
): boolean {
  if (!item) return true
  const action = normalizeToken(item.action || item.operation || "")
  const entityType = normalizeToken(item.entity_type || item.table_name || "")

  if (["sync", "migrate", "update_schema", "migration", "client_error"].includes(action)) return true
  if (["ui_runtime", "frontend"].includes(entityType)) return true
  return false
}

export function buildRecentActivity(
  filteredRawActivity: (DescribableAuditRow & { id: string; user_id: string | null; created_at: string })[],
  actorMap: Map<string, { first_name?: string; last_name?: string; company_email?: string }>
): RecentActivityItem[] {
  const rows = (filteredRawActivity || []).filter((item) => !isExcludedActivity(item))
  return describeActivityFeed(rows).map(({ row, sentence }) => {
    const actor = row.user_id ? actorMap.get(row.user_id) : undefined
    const actorName =
      actor?.first_name && actor?.last_name
        ? `${formatName(actor.first_name)} ${formatName(actor.last_name)}`
        : actor?.company_email || "System"

    return {
      id: row.id,
      actorName,
      // The feed renders "<actor> <actionLabel>", so the verb is lower-cased.
      actionLabel: asPredicate(sentence),
      moduleLabel: activitySentenceCase(activityModuleNoun(row)),
      moduleKey: normalizeToken(row.entity_type || row.table_name || "system"),
      createdAt: row.created_at,
    }
  })
}
