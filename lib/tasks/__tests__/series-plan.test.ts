import { strict as assert } from "node:assert"
import { test } from "node:test"
import { planPause, repeatsToCloseAfter, repeatsToHandOver, type SeriesTaskRow } from "../series-plan"

function repeat(occurrence: string, status = "pending", assigned_to = "ada"): SeriesTaskRow {
  return {
    id: `t-${occurrence}`,
    title: "Stock count",
    status,
    assigned_to,
    due_date: occurrence,
    task_end_date: occurrence,
    occurrence_date: occurrence,
  }
}

test("pausing a daily series skips the open repeats inside the pause", () => {
  const tasks = [repeat("2026-09-09"), repeat("2026-09-10"), repeat("2026-09-11"), repeat("2026-09-18")]
  const plan = planPause("working_daily", tasks, "2026-09-10", "2026-09-17", new Set())
  assert.deepEqual(
    plan.skip.map((t) => t.occurrence_date),
    ["2026-09-10", "2026-09-11"]
  )
  assert.equal(plan.move.length, 0)
})

test("pausing never touches work already submitted or finished", () => {
  const tasks = [repeat("2026-09-10", "submitted_for_review"), repeat("2026-09-11", "completed")]
  const plan = planPause("working_daily", tasks, "2026-09-10", "2026-09-17", new Set())
  assert.equal(plan.skip.length, 0)
})

test("pausing a monthly series moves its repeat to the first working day after", () => {
  const plan = planPause("monthly", [repeat("2026-10-01")], "2026-10-01", "2026-10-05", new Set())
  assert.deepEqual(plan.move, [{ task: repeat("2026-10-01"), due: "2026-10-06" }])
})

test("an open-ended pause holds a monthly repeat rather than moving it", () => {
  const plan = planPause("monthly", [repeat("2026-10-01")], "2026-09-28", null, new Set())
  assert.equal(plan.hold.length, 1)
  assert.equal(plan.move.length, 0)
})

test("ending a series closes only open repeats scheduled after today", () => {
  const tasks = [repeat("2026-10-29", "completed"), repeat("2026-10-30"), repeat("2026-11-02"), repeat("2026-11-03")]
  assert.deepEqual(
    repeatsToCloseAfter(tasks, "2026-10-30").map((t) => t.occurrence_date),
    ["2026-11-02", "2026-11-03"]
  )
})

test("a reassignment hands over repeats from its date, and today's only when asked", () => {
  const tasks = [repeat("2026-09-13", "in_progress"), repeat("2026-09-14"), repeat("2026-09-12", "completed")]
  assert.deepEqual(
    repeatsToHandOver(tasks, "tunde", "2026-09-14", false).map((t) => t.occurrence_date),
    ["2026-09-14"]
  )
  assert.deepEqual(
    repeatsToHandOver(tasks, "tunde", "2026-09-14", true).map((t) => t.occurrence_date),
    ["2026-09-13", "2026-09-14"]
  )
})
