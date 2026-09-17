import { strict as assert } from "node:assert"
import { test } from "node:test"
import { latestTaskDeadline, taskDeadlineWindowError } from "../deadline-window"

// 2026-09-21 is a Monday.
const MON = "2026-09-21"
const WED = "2026-09-23"
const FRI = "2026-09-25"
const NEXT_MON = "2026-09-28"
const NEXT_TUE = "2026-09-29"

test("five working days from a Monday is the next Monday", () => {
  assert.equal(latestTaskDeadline(MON), NEXT_MON)
})

test("weekends do not count toward the five days", () => {
  // Wed → Thu, Fri, Mon, Tue, Wed
  assert.equal(latestTaskDeadline(WED), "2026-09-30")
  // Fri → Mon..Fri
  assert.equal(latestTaskDeadline(FRI), "2026-10-02")
})

test("a public holiday pushes the limit out by a day", () => {
  assert.equal(latestTaskDeadline(MON, new Set(["2026-09-24"])), NEXT_TUE)
})

test("a start on a weekend counts from the following Monday", () => {
  assert.equal(latestTaskDeadline("2026-09-26"), "2026-10-02")
})

test("deadlines inside the window are allowed", () => {
  assert.equal(taskDeadlineWindowError({ startIso: MON, dueIso: MON }), null)
  assert.equal(taskDeadlineWindowError({ startIso: MON, dueIso: NEXT_MON }), null)
  assert.equal(taskDeadlineWindowError({ startIso: MON }), null)
})

test("a deadline past the window is rejected", () => {
  assert.match(taskDeadlineWindowError({ startIso: MON, dueIso: NEXT_TUE }) ?? "", /5 working days/)
  assert.match(taskDeadlineWindowError({ startIso: MON, endIso: NEXT_TUE }) ?? "", /5 working days/)
})

test("a deadline before the start is rejected", () => {
  assert.match(taskDeadlineWindowError({ startIso: WED, dueIso: MON }) ?? "", /before the start/)
})
