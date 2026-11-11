import test from "node:test"
import assert from "node:assert/strict"
import { classifyBulkDay, summarizeDays, type ExistingDay } from "@/lib/hr/bulk-day-review"

const base = { date: "2026-11-05", hasPending: false, onLeave: false }
const punch = (clock_in: string | null, clock_out: string | null, status = "present"): ExistingDay => ({
  status,
  clock_in,
  clock_out,
  source: "hikvision",
})

test("an empty day is staged with nothing to warn about", () => {
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing: null })
  assert.deepEqual(r, { date: "2026-11-05", action: "stage", flags: [] })
})

test("OOS skips a fully present day, but flags it", () => {
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing: punch("08:00", "17:00") })
  assert.equal(r.action, "skip")
  assert.deepEqual(r.flags, ["present"])
})

test("a waiver overrides a fully present day and says so", () => {
  const r = classifyBulkDay({ ...base, status: "waiver", existing: punch("08:00", "17:00") })
  assert.equal(r.action, "stage")
  assert.deepEqual(r.flags, ["present"])
})

test("a clock-in with no clock-out is overridden and flagged", () => {
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing: punch("08:00", null) })
  assert.equal(r.action, "stage")
  assert.deepEqual(r.flags, ["clock_in"])
})

test("a day that already has the status is skipped and flagged", () => {
  const existing: ExistingDay = { status: "out_of_station", clock_in: null, clock_out: null, source: "manual" }
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing })
  assert.equal(r.action, "skip")
  assert.deepEqual(r.flags, ["same_status"])
})

test("a different manual entry is replaced and names what it was", () => {
  const existing: ExistingDay = { status: "waiver", clock_in: null, clock_out: null, source: "manual" }
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing })
  assert.equal(r.action, "stage")
  assert.deepEqual(r.flags, ["other_manual"])
  assert.equal(r.existingStatus, "waiver")
})

test("an automatic record with no punches is not a manual bypass", () => {
  const existing: ExistingDay = { status: "absent", clock_in: null, clock_out: null, source: "hikvision" }
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing })
  assert.deepEqual(r.flags, [])
})

test("a pending change wins over everything and skips the day", () => {
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing: punch("08:00", "17:00"), hasPending: true })
  assert.equal(r.action, "skip")
  assert.deepEqual(r.flags, ["pending"])
})

test("leave is flagged alongside whatever else applies", () => {
  const r = classifyBulkDay({ ...base, status: "out_of_station", existing: null, onLeave: true })
  assert.equal(r.action, "stage")
  assert.deepEqual(r.flags, ["on_leave"])
})

test("summarizeDays groups dates by what they have and what happens to them", () => {
  const same: ExistingDay = { status: "out_of_station", clock_in: null, clock_out: null, source: "manual" }
  const days = [
    classifyBulkDay({ ...base, date: "2026-10-30", status: "out_of_station", existing: same }),
    classifyBulkDay({ ...base, date: "2026-10-28", status: "out_of_station", existing: same }),
    classifyBulkDay({ ...base, date: "2026-10-29", status: "out_of_station", existing: same }),
    classifyBulkDay({ ...base, date: "2026-10-31", status: "out_of_station", existing: null }),
  ]
  assert.deepEqual(summarizeDays(days), [
    { kind: "same_status", action: "skip", dates: ["2026-10-28", "2026-10-29", "2026-10-30"] },
  ])
})
