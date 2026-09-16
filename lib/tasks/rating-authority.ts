/**
 * Who may approve and rate a task.
 *
 * Nobody rates their own task - no exceptions, the MD included. A lead or
 * admin who assigns work to themselves would otherwise approve and score it
 * with no one else involved, and that score feeds their KPI (70% of the
 * appraisal).
 *
 * Those tasks used to be routed to the MD by name, as the one person above
 * every lead. That did not work: the MD reaches tasks through the lead view,
 * which is scoped to their own department, so every lead's self-assigned work
 * queued behind a single person who could not see most of it. Review is an
 * admin-side job instead - super admin, developer, or an admin with tasks
 * access - and the MD does it there like any other administrator. With that
 * pool there is always someone who is not the assignee, so the carve-out that
 * let the MD score their own work is gone too.
 *
 * The database enforces the same rule (tasks_guard_self_rating trigger); this
 * module is the application-side copy used by the API route and the UI.
 */

export const SELF_RATING_BLOCKED_REASON =
  "You can't approve or rate your own task. An administrator rates it from Admin › Tasks."

export type TaskReviewerProfile = {
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

export function isLeadForTaskDepartment(
  profile: TaskReviewerProfile | null | undefined,
  taskDepartment: string | null | undefined
): boolean {
  if (!profile?.is_department_lead || !taskDepartment) return false
  const leadDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return profile.department === taskDepartment || leadDepartments.includes(taskDepartment)
}

/** True when this user is an assignee of the task, whoever they are. */
export function isSelfRatingBlocked(params: {
  userId: string | null | undefined
  assigneeIds: ReadonlyArray<string | null | undefined>
}): boolean {
  if (!params.userId) return false
  return params.assigneeIds.some((id) => Boolean(id) && id === params.userId)
}
