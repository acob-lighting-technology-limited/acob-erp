import { strict as assert } from "node:assert"
import { test } from "node:test"
import {
  assigneeOn,
  creationDateFor,
  describeSchedule,
  dueDatesBetween,
  repeatsDue,
  repeatsHeldByPause,
  upcomingDueDates,
  type SeriesSchedule,
} from "../recurrence"

const daily: SeriesSchedule = { frequency: "working_daily", start_date: "2026-09-01", end_date: "2026-09-30" }

test("every working day skips weekends: September 2026 has 22 repeats", () => {
  const dates = dueDatesBetween(daily, "2026-09-01", "2026-09-30")
  assert.equal(dates.length, 22)
  assert.equal(dates[0], "2026-09-01")
  assert.equal(dates.at(-1), "2026-09-30")
  assert.ok(!dates.includes("2026-09-05"), "Saturday is not a working day")
})

test("every working day skips public holidays", () => {
  const holidays = new Set(["2026-09-15"])
  const dates = dueDatesBetween(daily, "2026-09-14", "2026-09-16", holidays)
  assert.deepEqual(dates, ["2026-09-14", "2026-09-16"])
})

test("the end date stops the series", () => {
  assert.deepEqual(dueDatesBetween(daily, "2026-10-01", "2026-10-31"), [])
})

test("weekly falls on the chosen weekday", () => {
  const weekly: SeriesSchedule = { frequency: "weekly", weekday: 5, start_date: "2026-10-01" }
  assert.deepEqual(dueDatesBetween(weekly, "2026-10-01", "2026-10-31"), [
    "2026-10-02",
    "2026-10-09",
    "2026-10-16",
    "2026-10-23",
    "2026-10-30",
  ])
})

test("a weekly repeat on a holiday moves to the working day before", () => {
  const weekly: SeriesSchedule = { frequency: "weekly", weekday: 5, start_date: "2026-10-01" }
  const dates = dueDatesBetween(weekly, "2026-10-12", "2026-10-18", new Set(["2026-10-16"]))
  assert.deepEqual(dates, ["2026-10-15"])
})

test("monthly on the 31st falls on the last day of shorter months", () => {
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "day", month_day: 31, start_date: "2026-01-01" }
  const dates = dueDatesBetween(monthly, "2026-04-01", "2026-04-30")
  assert.deepEqual(dates, ["2026-04-30"])
})

test("monthly on the 30th in February is the 28th, or the 29th in a leap year", () => {
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "day", month_day: 30, start_date: "2027-01-01" }
  // 28 Feb 2027 is a Sunday, so it moves back to Friday the 26th.
  assert.deepEqual(dueDatesBetween(monthly, "2027-02-01", "2027-02-28"), ["2027-02-26"])
  assert.deepEqual(dueDatesBetween(monthly, "2028-02-01", "2028-02-29"), ["2028-02-29"])
})

test("monthly on the last day that is a Saturday is due the Friday before", () => {
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "last_day", start_date: "2026-10-01" }
  assert.deepEqual(dueDatesBetween(monthly, "2026-10-01", "2026-10-31"), ["2026-10-30"])
})

test("a monthly date never moves back into the previous month", () => {
  // Sunday 1 Nov 2026: Friday 30 Oct would make November's repeat an October task.
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "day", month_day: 1, start_date: "2026-01-01" }
  assert.deepEqual(dueDatesBetween(monthly, "2026-10-26", "2026-11-06"), ["2026-11-02"])
})

test("a date that shifts back across a window edge is still found", () => {
  // 31 Jan 2027 is a Sunday: due Friday 29 Jan.
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "last_day", start_date: "2026-10-01" }
  assert.deepEqual(dueDatesBetween(monthly, "2027-01-25", "2027-01-29"), ["2027-01-29"])
})

test("quarterly is due on the last day of each calendar quarter", () => {
  const quarterly: SeriesSchedule = { frequency: "quarterly", start_date: "2026-01-01" }
  // 31 May 2026 is not a quarter end; 30 Sep and 31 Dec are; 30 Jun is a Tuesday.
  assert.deepEqual(dueDatesBetween(quarterly, "2026-05-01", "2026-12-31"), ["2026-06-30", "2026-09-30", "2026-12-31"])
})

test("quarterly created mid-quarter starts with the current quarter, not three months on", () => {
  const quarterly: SeriesSchedule = { frequency: "quarterly", start_date: "2027-02-15" }
  assert.equal(upcomingDueDates(quarterly, "2027-02-15", 1)[0], "2027-03-31")
})

test("yearly uses the chosen month and day", () => {
  const yearly: SeriesSchedule = {
    frequency: "yearly",
    year_month: 3,
    month_mode: "day",
    month_day: 31,
    start_date: "2026-11-01",
  }
  assert.deepEqual(upcomingDueDates(yearly, "2026-11-01", 2), ["2027-03-31", "2028-03-31"])
})

test("a scheduled date never moves before the series started", () => {
  // Starts Saturday 31 Oct; the 31st itself cannot move back to Friday the 30th.
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "last_day", start_date: "2026-10-31" }
  assert.deepEqual(dueDatesBetween(monthly, "2026-10-31", "2026-11-30"), ["2026-11-02", "2026-11-30"])
})

test("repeats are created ahead of time, within the five-working-day limit", () => {
  assert.equal(creationDateFor("working_daily", "2026-10-14", "2026-01-01"), "2026-10-14")
  assert.equal(creationDateFor("weekly", "2026-10-16", "2026-01-01"), "2026-10-12")
  // Five working days before Friday 30 Oct is Friday 23 Oct.
  assert.equal(creationDateFor("monthly", "2026-10-30", "2026-01-01"), "2026-10-23")
  // But never before the series starts.
  assert.equal(creationDateFor("monthly", "2026-10-30", "2026-10-27"), "2026-10-27")
})

test("the generator creates a repeat once its creation day arrives", () => {
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "last_day", start_date: "2026-01-01" }
  assert.deepEqual(repeatsDue(monthly, {}, "2026-10-22"), [])
  assert.deepEqual(repeatsDue(monthly, {}, "2026-10-23"), [
    { occurrence: "2026-10-30", due: "2026-10-30", created: "2026-10-23" },
  ])
})

test("a repeat whose deadline already passed is not created late", () => {
  const dailyOpen: SeriesSchedule = { frequency: "working_daily", start_date: "2026-09-01" }
  const planned = repeatsDue(dailyOpen, {}, "2026-09-10")
  assert.deepEqual(
    planned.map((p) => p.occurrence),
    ["2026-09-10"]
  )
})

test("a pause skips daily repeats instead of piling them up", () => {
  const dailyOpen: SeriesSchedule = { frequency: "working_daily", start_date: "2026-09-01" }
  const pause = { paused_from: "2026-09-10", paused_until: "2026-09-17" }
  assert.deepEqual(repeatsDue(dailyOpen, pause, "2026-09-14"), [])
  assert.deepEqual(
    repeatsDue(dailyOpen, pause, "2026-09-18").map((p) => p.due),
    ["2026-09-18"]
  )
})

test("a pause moves a monthly repeat to the first working day after it", () => {
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "day", month_day: 1, start_date: "2026-01-01" }
  const pause = { paused_from: "2026-10-01", paused_until: "2026-10-05" }
  const planned = repeatsDue(monthly, pause, "2026-09-29")
  assert.deepEqual(planned, [{ occurrence: "2026-10-01", due: "2026-10-06", created: "2026-09-29" }])
  // November is untouched: moving one repeat never moves the schedule.
  assert.deepEqual(upcomingDueDates(monthly, "2026-10-02", 1), ["2026-11-02"])
})

test("an open-ended pause holds monthly repeats until the series resumes", () => {
  const monthly: SeriesSchedule = { frequency: "monthly", month_mode: "day", month_day: 1, start_date: "2026-01-01" }
  const pause = { paused_from: "2026-09-28", paused_until: null }
  assert.deepEqual(repeatsDue(monthly, pause, "2026-10-01"), [])
  assert.deepEqual(repeatsHeldByPause(monthly, pause, "2026-10-07"), [
    { occurrence: "2026-10-01", due: "2026-10-07", created: "2026-10-07" },
  ])
})

test("resuming a daily series holds nothing back", () => {
  const dailyOpen: SeriesSchedule = { frequency: "working_daily", start_date: "2026-09-01" }
  assert.deepEqual(repeatsHeldByPause(dailyOpen, { paused_from: "2026-09-10" }, "2026-09-18"), [])
})

test("the holder on a date is the latest reassignment on or before it", () => {
  const rows = [
    { assigned_to: "ada", effective_from: "2026-09-01" },
    { assigned_to: "tunde", effective_from: "2026-09-13" },
    { assigned_to: "ada", effective_from: "2026-09-18" },
  ]
  assert.equal(assigneeOn(rows, "2026-09-12"), "ada")
  assert.equal(assigneeOn(rows, "2026-09-13"), "tunde")
  assert.equal(assigneeOn(rows, "2026-09-17"), "tunde")
  assert.equal(assigneeOn(rows, "2026-09-18"), "ada")
  assert.equal(assigneeOn(rows, "2026-08-01"), "ada")
})

test("schedules describe themselves in plain words", () => {
  assert.equal(describeSchedule({ frequency: "working_daily" }), "Every working day")
  assert.equal(describeSchedule({ frequency: "weekly", weekday: 5 }), "Weekly on Friday")
  assert.equal(describeSchedule({ frequency: "monthly", month_mode: "day", month_day: 22 }), "Monthly on the 22nd")
  assert.equal(describeSchedule({ frequency: "monthly", month_mode: "last_day" }), "Monthly on the last day")
  assert.equal(
    describeSchedule({ frequency: "yearly", year_month: 3, month_mode: "day", month_day: 31 }),
    "Yearly on 31 March"
  )
})
