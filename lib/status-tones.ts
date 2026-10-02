/**
 * Status → tone mapping. A tone is a *meaning*, not a colour:
 *   success  done / approved / healthy
 *   warning  waiting on someone / needs attention soon
 *   info     in progress / assigned / informational
 *   danger   rejected / failed / overdue / blocked
 *   neutral  draft / closed / cancelled / unknown
 * Colours come from theme tokens (globals.css), so every badge is correct in
 * light and dark mode. Add statuses here instead of a local colour map.
 */
export type StatusTone = "success" | "warning" | "info" | "danger" | "neutral"

const TONES: Record<string, StatusTone> = {
  // success
  active: "success",
  approved: "success",
  completed: "success",
  complete: "success",
  done: "success",
  resolved: "success",
  present: "success",
  paid: "success",
  sent: "success",
  submitted: "success",
  verified: "success",
  published: "success",
  available: "success",
  approved_for_procurement: "success",
  on_time: "success",
  // warning
  pending: "warning",
  pending_approval: "warning",
  pending_lead_review: "warning",
  pending_evidence: "warning",
  awaiting_review: "warning",
  in_review: "warning",
  under_review: "warning",
  returned: "warning",
  late: "warning",
  due: "warning",
  due_soon: "warning",
  suspended: "warning",
  maintenance: "warning",
  partial: "warning",
  needs_rating: "warning",
  // info
  open: "info",
  new: "info",
  assigned: "info",
  in_progress: "info",
  department_queue: "info",
  department_assigned: "info",
  scheduled: "info",
  on_leave: "info",
  processing: "info",
  not_started: "info",
  // danger
  rejected: "danger",
  failed: "danger",
  overdue: "danger",
  blocked: "danger",
  absent: "danger",
  exited: "danger",
  error: "danger",
  urgent: "danger",
  critical: "danger",
  high: "danger",
  // neutral
  draft: "neutral",
  closed: "neutral",
  cancelled: "neutral",
  archived: "neutral",
  inactive: "neutral",
  retired: "neutral",
  expired: "neutral",
  low: "neutral",
  medium: "info",
}

/** Tone for a status code; `overrides` lets a domain refine the defaults. */
export function statusTone(status: string | null | undefined, overrides?: Record<string, StatusTone>): StatusTone {
  const key = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  return overrides?.[key] ?? TONES[key] ?? "neutral"
}

/** "pending_lead_review" → "Pending lead review" */
export function statusLabel(status: string | null | undefined): string {
  const text = String(status || "unknown")
    .replace(/[_-]+/g, " ")
    .trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
