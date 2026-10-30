/**
 * Recurring task schedules: the date maths behind task_series.
 *
 * A series never holds work. The nightly generator asks this module which due
 * dates are owed and creates one ordinary task per date, so everything that
 * already understands tasks - grace, reminders, rating, the KPI - keeps
 * working unchanged. Pure functions only: the generator, the series API and
 * the form's preview all count dates the same way.
 *
 * The rules, as agreed:
 *
 *   working_daily  Mon-Fri, public holidays skipped
 *   weekly         a chosen weekday, Mon-Fri
 *   monthly        a day number, or the last day; a day the month does not
 *                  have (the 31st in April) falls on the month's last day
 *   quarterly      the last day of Mar, Jun, Sep and Dec - the review cycles
 *   yearly         a chosen month, then a day number or the last day
 *
 * A scheduled date that lands on a weekend or holiday moves to the working
 * day BEFORE it, so the work is ready ahead of the break rather than after -
 * unless that would push it into the previous month. "Monthly on the 1st"
 * with a Sunday 1st is due Monday the 2nd, not Friday the 30th, so every
 * month's repeat stays inside its own month.
 */

import {
  addIsoDays,
  firstWorkingDayOnOrAfter,
  isWorkingDay,
  lastWorkingDayOnOrBefore,
  NO_HOLIDAYS,
  type HolidaySet,
} from "@/lib/hr/leave-days"
import { TASK_MAX_WORKING_DAYS } from "@/lib/tasks/deadline-window"

export const SERIES_FREQUENCIES = ["working_daily", "weekly", "monthly", "quarterly", "yearly"] as const
export type SeriesFrequency = (typeof SERIES_FREQUENCIES)[number]

export const SERIES_MONTH_MODES = ["day", "last_day"] as const
export type SeriesMonthMode = (typeof SERIES_MONTH_MODES)[number]

export const SERIES_STATUSES = ["active", "paused", "ended"] as const
export type SeriesStatus = (typeof SERIES_STATUSES)[number]

export const SERIES_END_REASONS = ["completed_early", "no_longer_needed", "end_date_reached"] as const
export type SeriesEndReason = (typeof SERIES_END_REASONS)[number]

export const SERIES_FREQUENCY_LABELS: Record<SeriesFrequency, string> = {
  working_daily: "Every working day",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
}

export const SERIES_END_REASON_LABELS: Record<SeriesEndReason, string> = {
  completed_early: "Completed early",
  no_longer_needed: "No longer needed",
  end_date_reached: "End date reached",
}

/** ISO weekday numbers the weekly option offers. 1 = Monday. */
export const SERIES_WEEKDAYS = [1, 2, 3, 4, 5] as const
export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export type SeriesSchedule = {
  frequency: SeriesFrequency
  weekday?: number | null
  month_mode?: SeriesMonthMode | null
  month_day?: number | null
  year_month?: number | null
  start_date: string
  end_date?: string | null
}

/**
 * Frequencies whose repeats are skipped when they fall inside a pause, rather
 * than moved to after it. Six backup checks due on the day someone returns
 * helps nobody; a monthly stock count that never happens loses a whole month.
 */
export function pauseSkipsRepeats(frequency: SeriesFrequency): boolean {
  return frequency === "working_daily" || frequency === "weekly"
}

// ── Calendar primitives ────────────────────────────────────────────────

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function partsOf(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number)
  return { year, month, day }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** ISO weekday of a date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(iso: string): number {
  const { year, month, day } = partsOf(iso)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  return addIsoDays(iso, 1 - isoWeekday(iso))
}

/** A day of a given month, clamped so the 31st of April is the 30th. */
function dayInMonth(year: number, month: number, mode: SeriesMonthMode, day: number | null | undefined): string {
  const last = daysInMonth(year, month)
  const wanted = mode === "last_day" || !day ? last : Math.min(day, last)
  return isoOf(year, month, wanted)
}

/**
 * The working day a scheduled date is actually due on: the date itself when
 * it is a working day, otherwise the working day before it - but never
 * earlier than `floorIso`. When every earlier working day is below the floor,
 * the next working day is used instead.
 */
export function workingDueDate(scheduledIso: string, floorIso: string, holidays: HolidaySet = NO_HOLIDAYS): string {
  if (isWorkingDay(scheduledIso, holidays)) return scheduledIso
  return lastWorkingDayOnOrBefore(scheduledIso, holidays, floorIso) ?? firstWorkingDayOnOrAfter(scheduledIso, holidays)
}

/** How far back a date may move: its own month for monthly and longer, and never before the series. */
function shiftFloor(frequency: SeriesFrequency, scheduledIso: string, startIso: string): string {
  if (frequency === "working_daily" || frequency === "weekly") return startIso
  const monthStart = `${scheduledIso.slice(0, 8)}01`
  return monthStart > startIso ? monthStart : startIso
}

// ── Scheduled dates ────────────────────────────────────────────────────

/** Calendar dates the schedule names in [fromIso, toIso], before the working-day shift. */
function rawDatesBetween(schedule: SeriesSchedule, fromIso: string, toIso: string, holidays: HolidaySet): string[] {
  const dates: string[] = []
  const monthMode: SeriesMonthMode = schedule.month_mode ?? "last_day"

  switch (schedule.frequency) {
    case "working_daily": {
      let cursor = fromIso
      for (let guard = 0; cursor <= toIso && guard < 3700; guard += 1) {
        if (isWorkingDay(cursor, holidays)) dates.push(cursor)
        cursor = addIsoDays(cursor, 1)
      }
      return dates
    }
    case "weekly": {
      const weekday = schedule.weekday ?? 5
      let cursor = addIsoDays(mondayOf(fromIso), weekday - 1)
      for (let guard = 0; cursor <= toIso && guard < 600; guard += 1) {
        if (cursor >= fromIso) dates.push(cursor)
        cursor = addIsoDays(cursor, 7)
      }
      return dates
    }
    case "monthly":
    case "quarterly":
    case "yearly": {
      const from = partsOf(fromIso)
      const to = partsOf(toIso)
      let year = from.year
      let month = from.month
      for (let guard = 0; (year < to.year || (year === to.year && month <= to.month)) && guard < 1300; guard += 1) {
        let date: string | null = null
        if (schedule.frequency === "monthly") {
          date = dayInMonth(year, month, monthMode, schedule.month_day)
        } else if (schedule.frequency === "quarterly") {
          if (month % 3 === 0) date = dayInMonth(year, month, "last_day", null)
        } else if (month === (schedule.year_month ?? 12)) {
          date = dayInMonth(year, month, monthMode, schedule.month_day)
        }
        if (date && date >= fromIso && date <= toIso) dates.push(date)
        month += 1
        if (month > 12) {
          month = 1
          year += 1
        }
      }
      return dates
    }
  }
}

/**
 * Due dates the series owes in [fromIso, toIso], each already moved onto a
 * working day, sorted and unique. Bounded by the series' own start and end.
 *
 * The window is widened a little before scanning because a date just outside
 * it can shift into it (a Saturday the 1st of next month due on Friday the
 * 31st of this one).
 */
export function dueDatesBetween(
  schedule: SeriesSchedule,
  fromIso: string,
  toIso: string,
  holidays: HolidaySet = NO_HOLIDAYS
): string[] {
  const lower = fromIso > schedule.start_date ? fromIso : schedule.start_date
  const upper = schedule.end_date && schedule.end_date < toIso ? schedule.end_date : toIso
  if (upper < lower) return []

  const scanFrom = schedule.start_date > addIsoDays(lower, -1) ? schedule.start_date : addIsoDays(lower, -1)
  const raw = rawDatesBetween(schedule, scanFrom, addIsoDays(upper, 14), holidays)
  const seen = new Set<string>()
  const due: string[] = []
  for (const date of raw) {
    if (date < schedule.start_date) continue
    const shifted = workingDueDate(date, shiftFloor(schedule.frequency, date, schedule.start_date), holidays)
    if (shifted < lower || shifted > upper || seen.has(shifted)) continue
    seen.add(shifted)
    due.push(shifted)
  }
  return due.sort()
}

/** The next `count` due dates on or after `fromIso` - the form's preview. */
export function upcomingDueDates(
  schedule: SeriesSchedule,
  fromIso: string,
  count: number,
  holidays: HolidaySet = NO_HOLIDAYS
): string[] {
  // Two years covers three repeats of any frequency except yearly, which needs three.
  const horizon = schedule.frequency === "yearly" ? 365 * 3 + 2 : 731
  return dueDatesBetween(schedule, fromIso, addIsoDays(fromIso, horizon), holidays).slice(0, count)
}

/** The working day `count` working days before `iso`. */
function workingDaysBefore(iso: string, count: number, holidays: HolidaySet): string {
  let cursor = iso
  let counted = 0
  for (let guard = 0; counted < count && guard < 60; guard += 1) {
    cursor = addIsoDays(cursor, -1)
    if (isWorkingDay(cursor, holidays)) counted += 1
  }
  return cursor
}

/**
 * When the task for a due date is created, which is also its start date.
 *
 * New tasks may be due at most five working days after they start
 * (lib/tasks/deadline-window.ts), so that is the furthest ahead a repeat is
 * ever created:
 *
 *   working_daily   the morning it is due
 *   weekly          the Monday of its week
 *   the rest        five working days before it is due
 *
 * Never before the series itself starts.
 */
export function creationDateFor(
  frequency: SeriesFrequency,
  dueIso: string,
  seriesStartIso: string,
  holidays: HolidaySet = NO_HOLIDAYS
): string {
  let created: string
  if (frequency === "working_daily") created = dueIso
  else if (frequency === "weekly") created = mondayOf(dueIso)
  else created = workingDaysBefore(dueIso, TASK_MAX_WORKING_DAYS, holidays)
  return created < seriesStartIso ? seriesStartIso : created
}

// ── Pauses ─────────────────────────────────────────────────────────────

export type SeriesPause = { paused_from?: string | null; paused_until?: string | null }

/** Is this date inside the pause? An open-ended pause covers everything from its start. */
export function isInPause(dateIso: string, pause: SeriesPause): boolean {
  if (!pause.paused_from) return false
  if (dateIso < pause.paused_from) return false
  return !pause.paused_until || dateIso <= pause.paused_until
}

/** Where a moved repeat lands: the first working day after the last paused day. */
export function dueDateAfterPause(lastPausedIso: string, holidays: HolidaySet = NO_HOLIDAYS): string {
  return firstWorkingDayOnOrAfter(addIsoDays(lastPausedIso, 1), holidays)
}

export type PlannedRepeat = {
  /** The scheduled due date: the repeat's identity, unique within its series. */
  occurrence: string
  /** The deadline the task is created with - later than `occurrence` when a pause moved it. */
  due: string
  /** When the task is created; also its start date. */
  created: string
}

/**
 * The repeats a series should have created by `todayIso`: those whose creation
 * date has arrived and whose deadline has not yet passed.
 *
 * A repeat whose deadline passed before anyone created it - the job was down -
 * is left out on purpose. Creating it now would hand someone a task that is
 * overdue the moment it appears.
 *
 * Inside a pause, daily and weekly repeats are skipped. Monthly and longer are
 * moved to the first working day after a pause with an end date; under an
 * open-ended pause they wait, and resuming the series creates them.
 */
export function repeatsDue(
  schedule: SeriesSchedule,
  pause: SeriesPause,
  todayIso: string,
  holidays: HolidaySet = NO_HOLIDAYS
): PlannedRepeat[] {
  // Far enough ahead to see any repeat whose five-working-day lead has begun,
  // and back over a pause long enough for a moved repeat to still be owed.
  const lookBack = pause.paused_from && pause.paused_from < todayIso ? pause.paused_from : todayIso
  const occurrences = dueDatesBetween(schedule, lookBack, addIsoDays(todayIso, 31), holidays)
  const planned: PlannedRepeat[] = []

  for (const occurrence of occurrences) {
    let due = occurrence
    if (isInPause(occurrence, pause)) {
      if (pauseSkipsRepeats(schedule.frequency) || !pause.paused_until) continue
      due = dueDateAfterPause(pause.paused_until, holidays)
    }
    if (due < todayIso) continue
    const created = creationDateFor(schedule.frequency, due, schedule.start_date, holidays)
    if (created > todayIso) continue
    planned.push({ occurrence, due, created: created < todayIso ? todayIso : created })
  }
  return planned
}

/**
 * Monthly-and-longer repeats a pause has been holding back, owed once the
 * series resumes on `resumeIso`: every one scheduled from the start of the
 * pause up to the day before it ends, now due on the first working day from
 * the resume date. Daily and weekly repeats in a pause were skipped, not held,
 * so there are none of those.
 */
export function repeatsHeldByPause(
  schedule: SeriesSchedule,
  pause: SeriesPause,
  resumeIso: string,
  holidays: HolidaySet = NO_HOLIDAYS
): PlannedRepeat[] {
  if (!pause.paused_from || pauseSkipsRepeats(schedule.frequency)) return []
  const lastPaused = addIsoDays(resumeIso, -1)
  if (lastPaused < pause.paused_from) return []
  const due = firstWorkingDayOnOrAfter(resumeIso, holidays)
  return dueDatesBetween(schedule, pause.paused_from, lastPaused, holidays).map((occurrence) => ({
    occurrence,
    due,
    created: resumeIso,
  }))
}

// ── Ownership ──────────────────────────────────────────────────────────

export type SeriesAssigneeRow = { assigned_to: string; effective_from: string }

/**
 * Who holds the series on a date: the row with the latest effective_from on
 * or before it. A date before the first row belongs to the first holder.
 */
export function assigneeOn(rows: SeriesAssigneeRow[], dateIso: string): string | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  let holder = sorted[0].assigned_to
  for (const row of sorted) {
    if (row.effective_from <= dateIso) holder = row.assigned_to
    else break
  }
  return holder
}

// ── Labels ─────────────────────────────────────────────────────────────

function ordinal(day: number): string {
  const tens = day % 100
  if (tens >= 11 && tens <= 13) return `${day}th`
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th"
  return `${day}${suffix}`
}

/** "Monthly on the 15th", "Weekly on Friday" - for badges and the series sheet. */
export function describeSchedule(
  schedule: Pick<SeriesSchedule, "frequency" | "weekday" | "month_mode" | "month_day" | "year_month">
): string {
  const lastDay = schedule.month_mode !== "day" || !schedule.month_day
  switch (schedule.frequency) {
    case "working_daily":
      return "Every working day"
    case "weekly":
      return `Weekly on ${WEEKDAY_LABELS[schedule.weekday ?? 5] ?? "Friday"}`
    case "monthly":
      return lastDay ? "Monthly on the last day" : `Monthly on the ${ordinal(schedule.month_day as number)}`
    case "quarterly":
      return "Quarterly, last day of the quarter"
    case "yearly": {
      const month = MONTH_LABELS[(schedule.year_month ?? 12) - 1]
      return lastDay ? `Yearly on the last day of ${month}` : `Yearly on ${schedule.month_day} ${month}`
    }
  }
}

/** Short badge text: "Repeats monthly". */
export function repeatBadgeLabel(frequency: string | null | undefined): string | null {
  switch (frequency) {
    case "working_daily":
      return "Repeats daily"
    case "weekly":
      return "Repeats weekly"
    case "monthly":
      return "Repeats monthly"
    case "quarterly":
      return "Repeats quarterly"
    case "yearly":
      return "Repeats yearly"
    default:
      return null
  }
}
