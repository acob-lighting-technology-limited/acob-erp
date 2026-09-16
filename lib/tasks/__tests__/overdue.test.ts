import { strict as assert } from "node:assert"
import { test } from "node:test"
import {
  TASK_GRACE_WORKING_DAYS,
  calendarDaysBetween,
  isGraceExhausted,
  graceStartFor,
  isTaskOverdue,
  nonWorkingDaysFor,
  taskDeadline,
  TASK_ENFORCEMENT_START,
  workingDaysPastDeadline,
} from "../overdue"

// 2026-09-24 is a Thursday; 2026-09-26/27 the weekend that follows.
const THU = "2026-09-24"
const FRI = "2026-09-25"
const SAT = "2026-09-26"
const MON = "2026-09-28"
const TUE = "2026-09-29"

test("the deadline day itself is not overdue", () => {
  assert.equal(isTaskOverdue({ due_date: THU, status: "pending" }, THU), false)
})

test("a task is overdue the day after its deadline", () => {
  assert.equal(isTaskOverdue({ due_date: THU, status: "pending" }, FRI), true)
})

test("a closed-out task is never overdue", () => {
  for (const status of ["completed", "reassigned", "cancelled", "failed"]) {
    assert.equal(isTaskOverdue({ due_date: THU, status }, TUE), false, status)
  }
})

test("a task with no deadline is never overdue", () => {
  assert.equal(isTaskOverdue({ due_date: null, status: "pending" }, TUE), false)
})

test("task_end_date wins over due_date", () => {
  assert.equal(taskDeadline({ due_date: THU, task_end_date: MON }), MON)
  assert.equal(taskDeadline({ due_date: THU, task_end_date: null }), THU)
  assert.equal(taskDeadline({ due_date: null, task_end_date: null }), null)
})

test("a timestamp-shaped deadline is reduced to its date", () => {
  assert.equal(taskDeadline({ due_date: `${THU}T09:30:00+01:00` }), THU)
})

test("grace is counted in working days, so a weekend does not burn it", () => {
  assert.equal(workingDaysPastDeadline(THU, FRI), 0)
  assert.equal(workingDaysPastDeadline(THU, SAT), 1) // Friday elapsed
  assert.equal(workingDaysPastDeadline(THU, MON), 1) // still only Friday
  assert.equal(workingDaysPastDeadline(THU, TUE), 2) // Friday and Monday
})

test("a public holiday inside the grace does not burn it either", () => {
  const holidays = new Set([FRI])
  assert.equal(workingDaysPastDeadline(THU, TUE, holidays), 1)
  assert.equal(isGraceExhausted(THU, TUE, holidays), false)
})

test("a Thursday deadline fails on Tuesday, not over the weekend", () => {
  assert.equal(isGraceExhausted(THU, FRI), false)
  assert.equal(isGraceExhausted(THU, SAT), false)
  assert.equal(isGraceExhausted(THU, MON), false)
  assert.equal(isGraceExhausted(THU, TUE), true)
})

test("grace is never negative before the deadline", () => {
  assert.equal(workingDaysPastDeadline(THU, "2026-09-20"), 0)
  assert.equal(isGraceExhausted(THU, THU), false)
})

test("the grace window is the documented length", () => {
  assert.equal(TASK_GRACE_WORKING_DAYS, 2)
})

test("calendar day arithmetic does not drift", () => {
  assert.equal(calendarDaysBetween(THU, FRI), 1)
  assert.equal(calendarDaysBetween(FRI, THU), -1)
  assert.equal(calendarDaysBetween(THU, THU), 0)
  // Across a month boundary, and across the DST change northern Europe makes
  // in late October - these are calendar dates, so neither may shift a day.
  assert.equal(calendarDaysBetween("2026-09-30", "2026-10-01"), 1)
  assert.equal(calendarDaysBetween("2026-10-24", "2026-10-26"), 2)
})

test("approved leave does not burn grace", () => {
  // Off on the Friday and the Monday: nothing has elapsed by Tuesday.
  const onLeave = nonWorkingDaysFor(new Set<string>(), [FRI, MON])
  assert.equal(workingDaysPastDeadline(THU, TUE, onLeave), 0)
  assert.equal(isGraceExhausted(THU, TUE, onLeave), false)
})

test("a fortnight of leave holds the task open, it does not fail in absentia", () => {
  const fortnight = nonWorkingDaysFor(new Set<string>(), [
    "2026-09-25",
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-05",
    "2026-10-06",
  ])
  assert.equal(isGraceExhausted(THU, "2026-10-07", fortnight), false)
  // The first two working days back on the job burn the grace as normal.
  assert.equal(isGraceExhausted(THU, "2026-10-09", fortnight), true)
})

test("leave and public holidays combine rather than overwrite", () => {
  const combined = nonWorkingDaysFor(new Set([FRI]), [MON])
  assert.equal(combined.has(FRI), true)
  assert.equal(combined.has(MON), true)
  assert.equal(workingDaysPastDeadline(THU, TUE, combined), 0)
})

test("nonWorkingDaysFor does not mutate the holiday set it is given", () => {
  const holidays = new Set([FRI])
  nonWorkingDaysFor(holidays, [MON])
  assert.equal(holidays.has(MON), false)
})

test("someone who was not on leave is unaffected", () => {
  assert.equal(isGraceExhausted(THU, TUE, nonWorkingDaysFor(new Set<string>(), [])), true)
})

test("work already late when enforcement began gets its grace from that date", () => {
  const ancient = "2026-08-07" // 41 days late when the rule first fired
  assert.equal(graceStartFor(ancient), TASK_ENFORCEMENT_START)
  // Warned on the first night rather than failed outright.
  assert.equal(isGraceExhausted(graceStartFor(ancient), TASK_ENFORCEMENT_START), false)
  // Still warned on the Friday, and again on the Monday - 19/20 Sep is a
  // weekend, so only one working day has elapsed by then.
  assert.equal(isGraceExhausted(graceStartFor(ancient), "2026-09-18"), false)
  assert.equal(isGraceExhausted(graceStartFor(ancient), "2026-09-21"), false)
  // Failed on the Tuesday, once Friday and Monday have both passed.
  assert.equal(isGraceExhausted(graceStartFor(ancient), "2026-09-22"), true)
})

test("the amnesty does not touch work due on or after enforcement began", () => {
  assert.equal(graceStartFor(TASK_ENFORCEMENT_START), TASK_ENFORCEMENT_START)
  assert.equal(graceStartFor(THU), THU)
  assert.equal(isGraceExhausted(graceStartFor(THU), TUE), true)
})
