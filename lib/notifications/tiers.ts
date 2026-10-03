/**
 * Notification tiers (audit 2.1). Approvals and task reviews were going unread
 * 90%+ of the time, buried under announcements and system notices. Tiers keep
 * the work someone must do separate from news:
 *
 * - action:       someone is waiting on you — counted on the bell, never auto-read
 * - fyi:          an update about your own work — read when the bell list opens,
 *                 and dropped from the bell after 14 days
 * - announcement: company news — kept out of the bell, read on the notifications page
 */
export type NotificationTier = "action" | "fyi" | "announcement"

const ACTION_TYPES = new Set([
  "approval_request",
  "task_assigned",
  "task_awaiting_review",
  "task_needs_rating",
  "task_overdue",
  "task_due_soon",
  "task_blocked",
])

export const FYI_BELL_RETENTION_DAYS = 14

export function notificationTier(notification: { type?: string | null; priority?: string | null }): NotificationTier {
  const type = notification.type ?? ""
  if (type === "announcement") return "announcement"
  if (ACTION_TYPES.has(type)) return "action"
  // An urgent notice of any other type still needs a person's attention.
  if (notification.priority === "urgent") return "action"
  return "fyi"
}

/** FYI older than the retention window no longer belongs in the bell. */
export function isStaleFyi(notification: { created_at: string }, now = Date.now()): boolean {
  const age = now - new Date(notification.created_at).getTime()
  return age > FYI_BELL_RETENTION_DAYS * 24 * 60 * 60 * 1000
}
