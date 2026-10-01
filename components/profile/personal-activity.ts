import {
  activityModuleNoun,
  activitySentenceCase,
  describeActivityFeed,
  normalizeToken,
  type DescribableAuditRow,
} from "@/lib/audit/describe-activity"
import type { PersonalRecentActivityItem } from "./personal-recent-activity-feed"

/** The signed-in user's own audit rows as plain sentences for the profile feed. */
export function buildPersonalActivity(
  rows: (DescribableAuditRow & { id: string; created_at: string })[],
  userId: string
): PersonalRecentActivityItem[] {
  return describeActivityFeed(rows, { viewerId: userId }).map(({ row, sentence }) => ({
    id: row.id,
    actorName: "You",
    actionLabel: sentence,
    moduleLabel: activitySentenceCase(activityModuleNoun(row)),
    moduleKey: normalizeToken(row.entity_type || row.table_name || "system"),
    createdAt: row.created_at,
  }))
}
