/**
 * One definition of "is this task past its deadline", shared by every task
 * screen and by the nightly expiry job.
 *
 * Five call sites used to work this out independently, with three different
 * expressions between them, and they drifted. The profile page compared the
 * deadline against the current instant rather than the start of the day, so a
 * task due today rendered "1d overdue" from 01:00 WAT — a full day early, and
 * a day before the job that actually fails it.
 *
 * Deadlines are `date` columns, so every value in and out of this module is a
 * `YYYY-MM-DD` string compared as a string. No Date arithmetic on the boundary
 * itself, so there is no timezone left to get wrong; callers supply "today"
 * from `toLocalISODate()` (WAT) so the browser's own timezone never decides
 * whether someone is late.
 */

import { addIsoDays, isWorkingDay, NO_HOLIDAYS, type HolidaySet } from "@/lib/hr/leave-days"

/** Statuses where the work is closed out, so lateness no longer applies. */
export const TASK_TERMINAL_STATUSES = new Set(["completed", "reassigned", "cancelled", "failed"])

/**
 * Working days after the deadline before the nightly job fails a task
 * outright. The day the deadline passes the assignee and the assigner are
 * told and given this long to extend it or mark it unable to complete;
 * failing on the first night left no room for a human to intervene.
 */
export const TASK_GRACE_WORKING_DAYS = 2

const MAX_SCAN_DAYS = 400

/**
 * The date automatic failing starts counting from.
 *
 * The nightly job existed for weeks but had never actually failed anything, so
 * when it first ran properly there was a backlog of 29 open tasks going back
 * six weeks - people who had never been warned, under a rule that had never
 * once been enforced. Failing them on the first night would have been the
 * first any of them heard of it.
 *
 * So grace is counted from the later of the deadline and this date: a task
 * that was already late when enforcement began gets the same warning and the
 * same two working days as everything else, starting from here. It costs
 * nothing in fairness terms - an open overdue task and a failed one score
 * identically, zero at full weight - but it gives leads the chance to cancel
 * or reassign work that was never that employee's to finish, which is the only
 * thing that actually clears the zero.
 *
 * Inert for any task with a deadline on or after this date. Once the backlog
 * has washed through it can be deleted along with `graceStartFor`.
 */
export const TASK_ENFORCEMENT_START = "2026-09-17"

/**
 * Where this task's grace clock starts: its deadline, or the enforcement start
 * date if it was already overdue before automatic failing began.
 */
export function graceStartFor(deadlineIso: string): string {
  return deadlineIso < TASK_ENFORCEMENT_START ? TASK_ENFORCEMENT_START : deadlineIso
}

type DeadlineSource = {
  due_date?: string | null
  task_end_date?: string | null
}

/**
 * The date a task is measured against: `task_end_date` where set, otherwise
 * `due_date` — the same anchor the KPI calculation uses to decide which cycle
 * a task belongs to.
 */
export function taskDeadline(task: DeadlineSource): string | null {
  const value = task.task_end_date || task.due_date
  return value ? String(value).slice(0, 10) : null
}

export function isTerminalStatus(status: string | null | undefined): boolean {
  return Boolean(status && TASK_TERMINAL_STATUSES.has(status))
}

/** Whole calendar days from `fromIso` to `toIso` (negative when toIso is earlier). */
export function calendarDaysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  return Math.round((to - from) / 86_400_000)
}

/**
 * Past its deadline and still actionable. The deadline day itself is not
 * overdue — the assignee has all of it.
 */
export function isTaskOverdue(task: DeadlineSource & { status?: string | null }, todayIso: string): boolean {
  if (isTerminalStatus(task.status)) return false
  const deadline = taskDeadline(task)
  return Boolean(deadline) && deadline! < todayIso
}

/** How many calendar days late, counted from the day after the deadline. */
export function daysPastDeadline(deadlineIso: string, todayIso: string): number {
  return Math.max(0, calendarDaysBetween(deadlineIso, todayIso))
}

/**
 * Working days that have fully elapsed since the deadline: days strictly after
 * it and strictly before today. A Thursday deadline scores 0 on Friday, 1 on
 * Monday and 2 on Tuesday — so a Friday deadline is never failed over a
 * weekend the assignee could not have worked.
 *
 * `nonWorkingDays` is every date that should not burn grace for this
 * particular person: public holidays, plus any day they were on approved
 * leave. Someone signed off for a fortnight must not come back to a wall of
 * failed tasks they had no opportunity to deliver.
 */
export function workingDaysPastDeadline(
  deadlineIso: string,
  todayIso: string,
  nonWorkingDays: HolidaySet = NO_HOLIDAYS
): number {
  if (todayIso <= deadlineIso) return 0
  let count = 0
  let cursor = addIsoDays(deadlineIso, 1)
  let guard = 0
  while (cursor < todayIso && guard < MAX_SCAN_DAYS) {
    if (isWorkingDay(cursor, nonWorkingDays)) count += 1
    cursor = addIsoDays(cursor, 1)
    guard += 1
  }
  return count
}

/** True once the grace period is spent and the task should be failed. */
export function isGraceExhausted(
  deadlineIso: string,
  todayIso: string,
  nonWorkingDays: HolidaySet = NO_HOLIDAYS
): boolean {
  return workingDaysPastDeadline(deadlineIso, todayIso, nonWorkingDays) >= TASK_GRACE_WORKING_DAYS
}

/**
 * The dates that do not burn one person's grace: public holidays everyone
 * shares, plus the days this assignee was on approved leave. Weekends are not
 * listed - `isWorkingDay` already knows about those.
 */
export function nonWorkingDaysFor(holidays: HolidaySet, leaveDates: Iterable<string> = []): HolidaySet {
  const combined = new Set<string>(holidays)
  for (const date of leaveDates) combined.add(date)
  return combined
}

/**
 * True once an open task has exhausted its working-days grace period without submission.
 * Closed tasks and tasks reported blocked or awaiting review are not escalated.
 */
export function isTaskEscalated(
  task: DeadlineSource & { status?: string | null },
  todayIso: string,
  nonWorkingDays: HolidaySet = NO_HOLIDAYS
): boolean {
  if (isTerminalStatus(task.status)) return false
  const status = String(task.status || "").toLowerCase()
  if (status === "unable_to_complete" || status === "submitted_for_review") return false
  const deadline = taskDeadline(task)
  if (!deadline || deadline >= todayIso) return false
  return isGraceExhausted(deadline, todayIso, nonWorkingDays)
}
