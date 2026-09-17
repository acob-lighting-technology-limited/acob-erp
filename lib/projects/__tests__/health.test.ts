import { strict as assert } from "node:assert"
import { test } from "node:test"
import { computePortfolioHealth, computeProjectHealth, describeAttention, formatTimeUsed } from "../health"

const YEAR = { start: "2026-01-01", end: "2026-12-31" }

test("time used is measured against the project's own schedule", () => {
  const at = (today: string) => computeProjectHealth({ startDate: YEAR.start, endDate: YEAR.end, tasks: [], today })
  assert.equal(at("2026-01-01").timeUsedPct, 0)
  assert.equal(at("2026-12-31").timeUsedPct, 100)
  // Past the end date it stays at 100 and the overrun is reported separately.
  const late = at("2027-01-10")
  assert.equal(late.timeUsedPct, 100)
  assert.equal(late.daysOverrun, 10)
  assert.equal(at("2025-12-25").daysToStart, 7)
})

test("work done is a plain count of completed tasks", () => {
  const health = computeProjectHealth({
    startDate: YEAR.start,
    endDate: YEAR.end,
    today: "2026-03-01",
    tasks: [
      { status: "completed", rating: 4 },
      { status: "completed", rating: 2 },
      { status: "in_progress" },
      { status: "pending" },
      { status: "cancelled" },
      { status: "reassigned" },
      { status: "completed", is_archived: true },
    ],
  })
  assert.equal(health.taskCount, 4)
  assert.equal(health.doneCount, 2)
  assert.equal(health.workDonePct, 50)
  assert.equal(health.averageRating, 3)
})

test("a task past its due date is enough to flag a project", () => {
  const health = computeProjectHealth({
    startDate: YEAR.start,
    endDate: YEAR.end,
    today: "2026-02-01",
    tasks: [{ status: "completed" }, { status: "completed" }, { status: "in_progress", due_date: "2026-01-20" }],
  })
  assert.equal(health.overdueCount, 1)
  assert.equal(health.status, "at_risk")
  assert.equal(describeAttention(health), "1 task past due")
})

test("every task completed reads as done, whatever the calendar says", () => {
  const health = computeProjectHealth({
    startDate: YEAR.start,
    endDate: YEAR.end,
    today: "2027-03-01",
    tasks: [{ status: "completed" }],
  })
  assert.equal(health.status, "completed")
})

test("far behind is told apart from slipping", () => {
  const tasks = [{ status: "completed" }, { status: "pending" }, { status: "pending" }, { status: "pending" }]
  // 25% done. At 60% of the year that is 35 points behind; at 29% it is 4.
  const behind = computeProjectHealth({ startDate: YEAR.start, endDate: YEAR.end, today: "2026-08-08", tasks })
  assert.equal(behind.status, "behind_schedule")
  assert.equal(describeAttention(behind), `25% of work done with ${behind.timeUsedPct}% of time used`)

  const onTime = computeProjectHealth({ startDate: YEAR.start, endDate: YEAR.end, today: "2026-04-15", tasks })
  assert.equal(onTime.status, "on_track")
  assert.equal(describeAttention(onTime), null)
})

test("a project with no schedule is not flagged on work alone", () => {
  const health = computeProjectHealth({
    startDate: null,
    endDate: null,
    today: "2026-08-21",
    tasks: [{ status: "pending" }],
  })
  assert.equal(health.timeUsedPct, null)
  assert.equal(formatTimeUsed(health), null)
  assert.equal(health.status, "on_track")
})

test("time used reads in days for short schedules and weeks for long ones", () => {
  assert.equal(formatTimeUsed({ daysUsed: 12, daysTotal: 30 }), "12 of 30 days")
  assert.equal(formatTimeUsed({ daysUsed: 70, daysTotal: 140 }), "10 of 20 weeks")
})

test("portfolio work done counts every task, so a big project cannot be hidden", () => {
  const big = computeProjectHealth({
    startDate: YEAR.start,
    endDate: YEAR.end,
    today: "2026-08-21",
    tasks: Array.from({ length: 9 }, () => ({ status: "pending" })),
  })
  const small = computeProjectHealth({
    startDate: YEAR.start,
    endDate: YEAR.end,
    today: "2026-08-21",
    tasks: [{ status: "completed" }],
  })

  const rollup = computePortfolioHealth([big, small])
  assert.equal(rollup.projectCount, 2)
  assert.equal(rollup.completed, 1)
  // 1 of 10 tasks — not the 50% an average of the two projects would give.
  assert.equal(rollup.workDonePct, 10)
})

test("a plan is finished only when it has tasks and every one is done", () => {
  const health = computeProjectHealth({
    startDate: YEAR.start,
    endDate: YEAR.end,
    today: "2026-03-01",
    planIds: ["a", "b", "c"],
    tasks: [
      { status: "completed", plan_id: "a" },
      { status: "cancelled", plan_id: "a" },
      { status: "completed", plan_id: "b" },
      { status: "pending", plan_id: "b" },
    ],
  })
  // a: done (the cancelled task is left out). b: one task still open. c: no tasks yet.
  assert.equal(health.planCount, 3)
  assert.equal(health.plansDoneCount, 1)
  assert.equal(computePortfolioHealth([health, health]).plansDoneCount, 2)
})
