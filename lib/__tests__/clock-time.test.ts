import test from "node:test"
import assert from "node:assert/strict"
import { formatClockTime, formatWATDate } from "../utils/date"

test("a clock reading prints as 12-hour time with AM/PM", () => {
  assert.equal(formatClockTime("09:30"), "9:30 AM")
  assert.equal(formatClockTime("14:05"), "2:05 PM")
  assert.equal(formatClockTime("00:00"), "12:00 AM")
  assert.equal(formatClockTime("12:00"), "12:00 PM")
  assert.equal(formatClockTime("23:59"), "11:59 PM")
  assert.equal(formatClockTime("09:30:00"), "9:30 AM")
})

test("a month label from formatWATDate with the default day cancelled reads like 'October 2026'", () => {
  const label = formatWATDate("2026-10-01", { day: undefined, month: "long", year: "numeric" })
  assert.equal(label, "October 2026")
})

test("a date-only string is not pushed back a day (Lagos is ahead of UTC)", () => {
  assert.equal(formatWATDate("2026-03-01", { day: "numeric", month: "long", year: "numeric" }), "1 March 2026")
})
