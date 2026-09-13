/**
 * Who may approve and rate a task.
 *
 * Nobody rates their own task. A lead or admin who assigns a task to
 * themselves would otherwise approve and score it with no one else involved,
 * and that score feeds their KPI (70% of the appraisal). Those tasks go to the
 * MD — the head of Executive Management — who sits above every lead. The MD's
 * own tasks have no one above them; they are left out of KPI scoring instead.
 *
 * The database enforces the same rule (tasks_guard_self_rating trigger); this
 * module is the application-side copy used by the API route and the UI.
 */

export const SELF_RATING_BLOCKED_REASON = "You can't approve or rate your own task. It goes to the MD for rating."

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

/** True when this user is an assignee of the task and is not the MD. */
export function isSelfRatingBlocked(params: {
  userId: string | null | undefined
  assigneeIds: ReadonlyArray<string | null | undefined>
  isMd: boolean
}): boolean {
  if (params.isMd || !params.userId) return false
  return params.assigneeIds.some((id) => Boolean(id) && id === params.userId)
}
