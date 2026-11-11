import test from "node:test"
import assert from "node:assert/strict"
import { planRecordRemoval } from "@/lib/hr/record-removal"
import { DEFAULT_ATTENDANCE_POLICY } from "@/lib/org-config"

test("a purely manual record is deleted and the day derives from scratch", () => {
  const plan = planRecordRemoval({ date: "2026-11-10", clock_in: null, clock_out: null }, DEFAULT_ATTENDANCE_POLICY)
  assert.equal(plan.action, "delete")
  assert.equal(plan.status, "absent")
})

test("a weekend with no record shows as a weekend afterwards", () => {
  const plan = planRecordRemoval({ date: "2026-11-07", clock_in: null, clock_out: null }, DEFAULT_ATTENDANCE_POLICY)
  assert.equal(plan.action, "delete")
  assert.equal(plan.status, "weekend")
})

test("an override on a day with punches reverts to what the punches say, keeping them", () => {
  const plan = planRecordRemoval(
    { date: "2026-11-10", clock_in: "08:05:00", clock_out: "17:30:00" },
    DEFAULT_ATTENDANCE_POLICY
  )
  assert.equal(plan.action, "revert")
  assert.notEqual(plan.status, "out_of_station")
})

test("a clock-in alone also counts as punches and reverts rather than deletes", () => {
  const plan = planRecordRemoval(
    { date: "2026-11-10", clock_in: "08:05:00", clock_out: null },
    DEFAULT_ATTENDANCE_POLICY
  )
  assert.equal(plan.action, "revert")
})
