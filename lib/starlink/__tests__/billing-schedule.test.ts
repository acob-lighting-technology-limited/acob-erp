import { test } from "node:test"
import assert from "node:assert/strict"
import { reconcileStarlinkSchedule, type BillingEventForSchedule } from "../billing-schedule"

const NOW = new Date("2026-10-10T12:00:00Z")

const bill = (period: string, at = `${period}T02:00:00Z`): BillingEventForSchedule => ({
  kind: "reminder",
  receivedAt: at,
  periodStart: period,
})
const failed = (at: string): BillingEventForSchedule => ({ kind: "failed", receivedAt: at, periodStart: null })
const processed = (period: string, at: string): BillingEventForSchedule => ({
  kind: "processed",
  receivedAt: at,
  periodStart: period,
})

test("autopay months with no failure count as paid once the grace period passes", () => {
  const plan = reconcileStarlinkSchedule("2026-04-03", [bill("2026-04-03"), bill("2026-05-03")], NOW)
  assert.deepEqual(plan, { nextDue: "2026-06-03", monthsPaid: ["2026-04-03", "2026-05-03"], unpaid: [] })
})

test("a failed month stays due until a Payment Processed names it", () => {
  const events = [bill("2026-04-03"), failed("2026-04-03T11:00:00Z"), bill("2026-05-03")]
  assert.equal(reconcileStarlinkSchedule("2026-04-03", events, NOW), null)

  const settled = [...events, processed("2026-04-03", "2026-04-06T21:00:00Z")]
  assert.deepEqual(reconcileStarlinkSchedule("2026-04-03", settled, NOW)?.monthsPaid, ["2026-04-03", "2026-05-03"])
})

test("reports failed months with no retry as unpaid, and stops there", () => {
  const plan = reconcileStarlinkSchedule(
    "2026-04-03",
    [bill("2026-04-03"), bill("2026-05-03"), failed("2026-05-03T09:00:00Z"), bill("2026-06-03")],
    NOW
  )
  assert.deepEqual(plan, { nextDue: "2026-05-03", monthsPaid: ["2026-04-03"], unpaid: ["2026-05-03"] })
})

test("a fresh bill inside the grace period is not yet counted", () => {
  const plan = reconcileStarlinkSchedule("2026-10-03", [bill("2026-10-03", "2026-10-09T02:00:00Z")], NOW)
  assert.equal(plan, null)
})

test("never moves the schedule backwards over months already settled", () => {
  const plan = reconcileStarlinkSchedule("2026-04-03", [bill("2026-02-03"), bill("2026-03-03")], NOW)
  assert.equal(plan, null)
})

test("does not skip over a month with no bill on record", () => {
  const plan = reconcileStarlinkSchedule("2026-04-03", [bill("2026-04-03"), bill("2026-06-03")], NOW)
  assert.deepEqual(plan?.nextDue, "2026-05-03")
})
