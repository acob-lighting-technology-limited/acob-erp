import { strict as assert } from "node:assert"
import { test } from "node:test"
import { generateEventOccurrences } from "../recurrence"

// 2026-10-05 is a Monday in WAT
const MON_START = "2026-10-05T09:00:00+01:00"
const MON_END = "2026-10-05T10:00:00+01:00"

test("frequency 'none' returns only the base occurrence", () => {
  const res = generateEventOccurrences({
    start_at: MON_START,
    end_at: MON_END,
    all_day: false,
    frequency: "none",
    holidayDates: new Set(),
  })
  assert.equal(res.scheduled.length, 1)
  assert.equal(res.scheduled[0].start_at, MON_START)
  assert.equal(res.skippedHolidays.length, 0)
})

test("weekly recurrence generates 4 consecutive Mondays", () => {
  const res = generateEventOccurrences({
    start_at: MON_START,
    end_at: MON_END,
    all_day: false,
    frequency: "weekly",
    count: 4,
    holidayDates: new Set(),
  })
  assert.equal(res.scheduled.length, 4)
  assert.equal(res.scheduled[0].start_at, "2026-10-05T08:00:00.000Z") // UTC for 09:00 WAT
  assert.equal(res.scheduled[1].start_at, "2026-10-12T08:00:00.000Z")
  assert.equal(res.scheduled[2].start_at, "2026-10-19T08:00:00.000Z")
  assert.equal(res.scheduled[3].start_at, "2026-10-26T08:00:00.000Z")
  assert.equal(res.skippedHolidays.length, 0)
})

test("dynamically skips occurrence landing on a public holiday", () => {
  // 2026-10-19 is declared a public holiday
  const holidayDates = new Set(["2026-10-19"])
  const res = generateEventOccurrences({
    start_at: MON_START,
    end_at: MON_END,
    all_day: false,
    frequency: "weekly",
    count: 4,
    holidayDates,
    skip_holidays: true,
  })
  assert.equal(res.scheduled.length, 3)
  assert.deepEqual(res.skippedHolidays, ["2026-10-19"])
  // The scheduled list should not contain 2026-10-19
  assert.equal(
    res.scheduled.some((o) => o.start_at.includes("2026-10-19")),
    false
  )
})

test("does not skip holiday if skip_holidays is false", () => {
  const holidayDates = new Set(["2026-10-19"])
  const res = generateEventOccurrences({
    start_at: MON_START,
    end_at: MON_END,
    all_day: false,
    frequency: "weekly",
    count: 4,
    holidayDates,
    skip_holidays: false,
  })
  assert.equal(res.scheduled.length, 4)
  assert.equal(res.skippedHolidays.length, 0)
})

test("stops when until limit is reached", () => {
  const res = generateEventOccurrences({
    start_at: MON_START,
    end_at: MON_END,
    all_day: false,
    frequency: "weekly",
    count: 10,
    until: "2026-10-15", // Should only include Oct 5 and Oct 12
    holidayDates: new Set(),
  })
  assert.equal(res.scheduled.length, 2)
})
