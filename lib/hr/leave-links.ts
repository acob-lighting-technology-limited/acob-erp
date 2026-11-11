/**
 * Where a leave notification should land. The leave page has three tabs, and the
 * tab used to be plain component state, so every email and notification opened
 * "My Requests" even when it asked the reader to approve something. A link that
 * asks someone to act must open the tab where they act.
 */

export type LeaveTab = "my-requests" | "reviews" | "reviewed"

const LEAVE_TABS: readonly LeaveTab[] = ["my-requests", "reviews", "reviewed"]

/** Pending Reviews: reliever confirmations and lead / HR / MD approvals owed by the reader. */
export const LEAVE_REVIEWS_PATH = "/hr/leave?tab=reviews"

/** Reads the `tab` query value, falling back to My Requests for anything unknown. */
export function parseLeaveTab(value: string | string[] | undefined | null): LeaveTab {
  const raw = Array.isArray(value) ? value[0] : value
  return LEAVE_TABS.find((tab) => tab === raw) ?? "my-requests"
}
