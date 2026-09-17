import { strict as assert } from "node:assert"
import { test } from "node:test"
import { computeWeightedTaskScore, isTaskInCycle, isTaskScorable, isTaskUnresolved } from "../scoring"

test("a task earns its weight scaled by its rating", () => {
  const { score, earnedPoints, availablePoints } = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 4 },
  ])
  assert.equal(earnedPoints, 4)
  assert.equal(availablePoints, 5)
  assert.equal(score, 80)
})

test("weights decide how much each task moves the score", () => {
  // Heavy task rated poorly, light task rated perfectly: the heavy one dominates.
  const { score } = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 1 },
    { status: "completed", weight: 1, rating: 5 },
  ])
  // (5*0.2 + 1*1) / 6 = 2/6
  assert.equal(score, 33.33)
})

test("failed work scores zero at full weight, so skipping tasks cannot raise a score", () => {
  const finishedOnly = computeWeightedTaskScore([{ status: "completed", weight: 5, rating: 5 }])
  const withAbandoned = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 5 },
    { status: "failed", weight: 5, rating: null },
  ])
  assert.equal(finishedOnly.score, 100)
  assert.equal(withAbandoned.score, 50)
  assert.ok(withAbandoned.score! < finishedOnly.score!)
})

test("work still in progress is not yet judged, so it does not drag the score down", () => {
  // A task due at the end of the quarter must not score its owner zero for
  // every week they are not yet late; the expiry job fails it if it lapses.
  const { score, taskCount, unresolvedCount } = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 5 },
    { status: "pending", weight: 5, rating: null },
    { status: "in_progress", weight: 5, rating: null },
    { status: "unable_to_complete", weight: 5, rating: null },
  ])
  assert.equal(unresolvedCount, 3)
  assert.equal(taskCount, 1)
  assert.equal(score, 100)
})

test("unresolved work enters the score the moment it is failed", () => {
  const inFlight = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 5 },
    { status: "pending", weight: 5, rating: null },
  ])
  const lapsed = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 5 },
    { status: "failed", weight: 5, rating: null },
  ])
  assert.equal(inFlight.score, 100)
  assert.equal(lapsed.score, 50)
})

test("unresolved is distinct from excluded and from archived", () => {
  assert.equal(isTaskUnresolved({ status: "pending" }), true)
  assert.equal(isTaskUnresolved({ status: "in_progress" }), true)
  assert.equal(isTaskUnresolved({ status: "unable_to_complete" }), true)
  assert.equal(isTaskUnresolved({ status: "failed" }), false)
  assert.equal(isTaskUnresolved({ status: "cancelled" }), false)
  assert.equal(isTaskUnresolved({ status: "pending", is_archived: true }), false)
  assert.equal(isTaskScorable({ status: "pending" }), false)
  assert.equal(isTaskScorable({ status: "failed" }), true)
})

test("reassigned and cancelled work is neutral", () => {
  assert.equal(isTaskScorable({ status: "reassigned", weight: 5, rating: null }), false)
  assert.equal(isTaskScorable({ status: "cancelled", weight: 5, rating: null }), false)

  const { score, taskCount } = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 5 },
    { status: "reassigned", weight: 5, rating: null },
    { status: "cancelled", weight: 5, rating: null },
  ])
  assert.equal(taskCount, 1)
  assert.equal(score, 100)
})

test("delivered work awaiting a rating is held out rather than scored zero", () => {
  const { score, awaitingRatingCount, taskCount } = computeWeightedTaskScore([
    { status: "completed", weight: 5, rating: 4 },
    { status: "submitted_for_review", weight: 5, rating: null },
  ])
  assert.equal(awaitingRatingCount, 1)
  assert.equal(taskCount, 1)
  assert.equal(score, 80)
})

test("archived tasks never score", () => {
  const { score } = computeWeightedTaskScore([{ status: "completed", weight: 5, rating: 5, is_archived: true }])
  assert.equal(score, null)
})

test("no assigned work is null, not zero", () => {
  assert.equal(computeWeightedTaskScore([]).score, null)
})

test("out-of-range weights are clamped rather than trusted", () => {
  const { availablePoints } = computeWeightedTaskScore([
    { status: "completed", weight: 999, rating: 5 },
    { status: "completed", weight: 0, rating: 5 },
  ])
  assert.equal(availablePoints, 6) // 5 + 1
})

test("a task belongs to the cycle its deadline falls in, not the one it was finished in", () => {
  const q1 = { start: "2026-01-01", end: "2026-03-31" }

  // Due in March, dragged into May: still Q1's task.
  assert.equal(isTaskInCycle({ task_end_date: "2026-03-20", created_at: "2026-01-05" }, q1.start, q1.end), true)

  // task_end_date wins over due_date when both are present.
  assert.equal(isTaskInCycle({ task_end_date: "2026-05-01", due_date: "2026-02-01" }, q1.start, q1.end), false)

  // No deadline at all falls back to when it was raised.
  assert.equal(isTaskInCycle({ created_at: "2026-02-10T09:00:00Z" }, q1.start, q1.end), true)

  // Nothing to anchor on cannot be placed in any cycle.
  assert.equal(isTaskInCycle({}, q1.start, q1.end), false)
})

test("legacy completed work with no rating is held back, not scored zero", () => {
  // A rating is mandatory to complete a task now, so an unrated completed row
  // predates that rule. Scoring it zero would punish finished work.
  const { score, awaitingRatingCount } = computeWeightedTaskScore([
    { status: "completed", weight: 4, rating: 4 },
    { status: "completed", weight: 5, rating: null },
  ])
  assert.equal(awaitingRatingCount, 1)
  assert.equal(score, 80)
})

test("a project's quality counts unfinished work, an employee's KPI does not", () => {
  const tasks = [
    { status: "completed", weight: 5, rating: 5 },
    { status: "pending", weight: 5, rating: null },
  ]
  // The employee has not been judged on the pending task yet.
  assert.equal(computeWeightedTaskScore(tasks).score, 100)
  // The project has half its planned work untouched and must not read perfect.
  assert.equal(computeWeightedTaskScore(tasks, { countUnresolvedAsZero: true }).score, 50)
})
