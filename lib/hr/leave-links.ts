/**
 * Where a leave notification should land. The leave page has three tabs, and the tab used to be
 * plain component state, so every email and notification opened "My Requests" even when it asked
 * the reader to approve something. A link that asks someone to act must open the tab where they
 * act; the page reads `?tab=` through `useUrlTab`.
 */

/** Pending Reviews: reliever confirmations and lead / HR / MD approvals owed by the reader. */
export const LEAVE_REVIEWS_PATH = "/hr/leave?tab=reviews"
