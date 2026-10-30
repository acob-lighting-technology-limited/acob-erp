/**
 * The decisions behind series actions, as pure functions: which existing
 * repeats a pause skips, moves or holds; which an end closes; which a
 * reassignment hands over. lib/tasks/series-actions.ts carries them out.
 */

import type { HolidaySet } from "@/lib/hr/leave-days"
import { taskDeadline } from "@/lib/tasks/overdue"
import { dueDateAfterPause, pauseSkipsRepeats, type SeriesFrequency } from "@/lib/tasks/recurrence"

export type SeriesTaskRow = {
  id: string
  title: string
  status: string
  assigned_to: string | null
  due_date: string | null
  task_end_date: string | null
  occurrence_date: string | null
}

export const SERIES_TASK_COLUMNS = "id, title, status, assigned_to, due_date, task_end_date, occurrence_date"

/** Not yet delivered: these still have a deadline that a pause, an end or a reassignment affects. */
const OPEN_STATUSES = new Set(["pending", "in_progress", "unable_to_complete"])

export function isOpenRepeat(task: Pick<SeriesTaskRow, "status">): boolean {
  return OPEN_STATUSES.has(task.status)
}

export type PausePlan = {
  /** Closed as not planned: daily and weekly repeats due inside the pause. */
  skip: SeriesTaskRow[]
  /** Monthly and longer, given a new deadline after a pause with an end date. */
  move: Array<{ task: SeriesTaskRow; due: string }>
  /** Monthly and longer under an open-ended pause: kept, and moved on resume. */
  hold: SeriesTaskRow[]
}

/**
 * What pausing does to repeats that already exist. Only open repeats whose
 * deadline falls inside the pause are touched; work already submitted is left
 * alone, since it has been delivered.
 */
export function planPause(
  frequency: SeriesFrequency,
  tasks: SeriesTaskRow[],
  from: string,
  until: string | null,
  holidays: HolidaySet
): PausePlan {
  const plan: PausePlan = { skip: [], move: [], hold: [] }
  for (const task of tasks) {
    if (!isOpenRepeat(task)) continue
    const deadline = taskDeadline(task)
    if (!deadline || deadline < from || (until && deadline > until)) continue
    if (pauseSkipsRepeats(frequency)) plan.skip.push(task)
    else if (until) plan.move.push({ task, due: dueDateAfterPause(until, holidays) })
    else plan.hold.push(task)
  }
  return plan
}

/** Open repeats scheduled after `afterIso` - what ending a series, or an earlier end date, closes. */
export function repeatsToCloseAfter(tasks: SeriesTaskRow[], afterIso: string): SeriesTaskRow[] {
  return tasks.filter((task) => isOpenRepeat(task) && (task.occurrence_date ?? "") > afterIso)
}

/**
 * Which open repeats a reassignment hands over: every one scheduled from the
 * effective date, plus - when asked - the ones already under way before it.
 */
export function repeatsToHandOver(
  tasks: SeriesTaskRow[],
  newAssignee: string,
  effectiveFrom: string,
  moveOpen: boolean
): SeriesTaskRow[] {
  return tasks.filter(
    (task) =>
      isOpenRepeat(task) &&
      task.assigned_to !== newAssignee &&
      (moveOpen || (task.occurrence_date ?? "") >= effectiveFrom)
  )
}
