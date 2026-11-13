import { addIsoDays, isWorkingDay, NO_HOLIDAYS, type HolidaySet } from "@/lib/hr/leave-days"
import { workingDaysPastDeadline } from "@/lib/tasks/overdue"

/**
 * Asset acceptance: the person given an asset confirms they received it, or says they did not.
 *
 * It never blocks the assignment. If they do nothing, they get one reminder after a working day, and
 * after ACCEPTANCE_WORKING_DAYS full working days the assignment counts as accepted
 * ("auto_accepted"). Weekends, public holidays and the person's own approved leave do not count, so
 * someone away for a week is not deemed to have accepted something they never saw.
 *
 * The clock starts the day the assignment was entered (created_at in WAT), not its assigned_at, which
 * an admin can backdate.
 */

export type AcceptanceStatus = "not_required" | "pending" | "accepted" | "auto_accepted" | "disputed"

export const ACCEPTANCE_WORKING_DAYS = 3
export const REMIND_AFTER_WORKING_DAYS = 1

export const ACCEPTANCE_LABELS: Record<AcceptanceStatus, string> = {
  not_required: "Before acceptance",
  pending: "Awaiting acceptance",
  accepted: "Accepted",
  auto_accepted: "Accepted automatically",
  disputed: "Disputed",
}

export type AcceptanceStep = "auto_accept" | "remind" | "wait"

/** What the daily job should do with one pending acceptance today. */
export function acceptanceStep(
  enteredIso: string,
  todayIso: string,
  alreadyReminded: boolean,
  nonWorkingDays: HolidaySet = NO_HOLIDAYS
): AcceptanceStep {
  const elapsed = workingDaysPastDeadline(enteredIso, todayIso, nonWorkingDays)
  if (elapsed >= ACCEPTANCE_WORKING_DAYS) return "auto_accept"
  // Nobody is reminded on a day they are not working.
  if (!alreadyReminded && elapsed >= REMIND_AFTER_WORKING_DAYS && isWorkingDay(todayIso, nonWorkingDays)) {
    return "remind"
  }
  return "wait"
}

/**
 * The last day the person can respond before it counts as accepted: the ACCEPTANCE_WORKING_DAYS-th
 * working day after the day it was entered. Shown as "Please confirm by …".
 */
export function acceptanceRespondBy(enteredIso: string, nonWorkingDays: HolidaySet = NO_HOLIDAYS): string {
  let cursor = enteredIso
  let counted = 0
  let guard = 0
  while (counted < ACCEPTANCE_WORKING_DAYS && guard < 60) {
    cursor = addIsoDays(cursor, 1)
    if (isWorkingDay(cursor, nonWorkingDays)) counted += 1
    guard += 1
  }
  return cursor
}
