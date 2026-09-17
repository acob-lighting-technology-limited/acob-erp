/**
 * How far out a new task's deadline may be set: no more than five working
 * days after its start date. Longer pieces of work are meant to be broken into
 * tasks that each land inside a week, so progress is rated as it happens rather
 * than in one lump at the end.
 *
 * Shared by the task dialog (to cap the date picker and explain the limit) and
 * by POST /api/tasks (which is the actual enforcement), so both count working
 * days the same way: weekends never count, nor does a public holiday.
 *
 * Only creation is capped. An existing task's deadline moves through the
 * extension flow, which carries its own reason and approval.
 */

import { addIsoDays, isWorkingDay, NO_HOLIDAYS, type HolidaySet } from "@/lib/hr/leave-days"

export const TASK_MAX_WORKING_DAYS = 5

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The latest deadline a task starting on `startIso` may have: the fifth
 * working day after the start. A Monday start allows up to the next Monday.
 */
export function latestTaskDeadline(startIso: string, holidays: HolidaySet = NO_HOLIDAYS): string {
  let cursor = startIso
  let counted = 0
  // Bounded: even a run of holidays cannot hold back five working days for long.
  for (let guard = 0; counted < TASK_MAX_WORKING_DAYS && guard < 60; guard += 1) {
    cursor = addIsoDays(cursor, 1)
    if (isWorkingDay(cursor, holidays)) counted += 1
  }
  return cursor
}

/**
 * The reason a new task's dates are not allowed, or null when they are.
 * Either deadline field is checked, since `task_end_date` wins over `due_date`
 * wherever a task's deadline is read.
 */
export function taskDeadlineWindowError(
  dates: { startIso: string; dueIso?: string | null; endIso?: string | null },
  holidays: HolidaySet = NO_HOLIDAYS
): string | null {
  const start = dates.startIso.slice(0, 10)
  if (!ISO_DATE.test(start)) return "Start date is not a valid date"

  const latest = latestTaskDeadline(start, holidays)
  for (const value of [dates.dueIso, dates.endIso]) {
    if (!value) continue
    const deadline = value.slice(0, 10)
    if (!ISO_DATE.test(deadline)) return "Due date is not a valid date"
    if (deadline < start) return "Due date cannot be before the start date"
    if (deadline > latest) {
      return `Due date must be within ${TASK_MAX_WORKING_DAYS} working days of the start date (latest ${latest})`
    }
  }
  return null
}
