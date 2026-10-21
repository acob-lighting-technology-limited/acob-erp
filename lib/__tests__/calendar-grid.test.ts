import { test } from "node:test"
import assert from "node:assert/strict"
import { buildCalendarCells, monBasedDay, navigateMonth } from "../utils/calendar-grid"

test("weeks start on Monday", () => {
  assert.equal(monBasedDay(1), 0)
  assert.equal(monBasedDay(0), 6)
})

test("October 2026 starts on a Thursday and pads to whole weeks", () => {
  const cells = buildCalendarCells("2026-10")
  assert.equal(cells.length % 7, 0)
  assert.deepEqual(cells.slice(0, 4), [null, null, null, "2026-10-01"])
  assert.equal(cells.filter(Boolean).length, 31)
})

test("navigateMonth crosses year boundaries", () => {
  assert.equal(navigateMonth("2026-12", 1), "2027-01")
  assert.equal(navigateMonth("2026-01", -1), "2025-12")
})
