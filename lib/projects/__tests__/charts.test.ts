import { strict as assert } from "node:assert"
import { test } from "node:test"
import { buildProgressOverTime, buildTaskBreakdown, buildWeeklyFinished, weekStart, type ChartProject } from "../charts"

const project = (overrides: Partial<ChartProject>): ChartProject => ({
  id: "p",
  project_name: "Project",
  portfolioId: null,
  startDate: "2026-09-07",
  endDate: "2026-10-05",
  tasks: [],
  ...overrides,
})

test("weeks start on Monday", () => {
  assert.equal(weekStart("2026-09-17"), "2026-09-14")
  assert.equal(weekStart("2026-09-14T08:00:00Z"), "2026-09-14")
  assert.equal(weekStart("2026-09-20"), "2026-09-14")
})

test("finished tasks without a date count from the start, so the line ends at the real total", () => {
  const { points, total, undatedDone } = buildProgressOverTime(
    [
      project({
        tasks: [
          { status: "completed" },
          { status: "completed", completed_at: "2026-09-15T10:00:00Z" },
          { status: "pending" },
          { status: "cancelled" },
        ],
      }),
    ],
    "2026-09-17"
  )
  assert.equal(total, 3)
  assert.equal(undatedDone, 1)
  assert.deepEqual(
    points.map((p) => [p.week, p.done]),
    [
      ["2026-09-07", 1],
      ["2026-09-14", 2],
      ["2026-09-21", null],
      ["2026-09-28", null],
      ["2026-10-05", null],
    ]
  )
  // The on-pace line reaches every task by the end date.
  assert.equal(points.at(-1)?.onPace, 3)
})

test("projects without dates stay off the on-pace line", () => {
  const result = buildProgressOverTime(
    [project({ startDate: null, endDate: null, tasks: [{ status: "pending" }] })],
    "2026-09-17"
  )
  assert.equal(result.unscheduledProjects, 1)
  assert.ok(result.points.every((p) => p.onPace === null))
})

test("weekly finished counts only dated completions, oldest week first", () => {
  const { points, undated } = buildWeeklyFinished(
    [
      project({
        tasks: [
          { status: "completed", completed_at: "2026-09-15T10:00:00Z" },
          { status: "completed", completed_at: "2026-09-16T10:00:00Z" },
          { status: "completed", completed_at: "2026-09-02T10:00:00Z" },
          { status: "completed" },
        ],
      }),
    ],
    "2026-09-17",
    3
  )
  assert.deepEqual(points, [
    { week: "2026-08-31", finished: 1 },
    { week: "2026-09-07", finished: 0 },
    { week: "2026-09-14", finished: 2 },
  ])
  assert.equal(undated, 1)
})

test("a late task counts as past due, never as in progress", () => {
  const [row] = buildTaskBreakdown(
    [
      project({
        tasks: [
          { status: "completed" },
          { status: "in_progress", due_date: "2026-09-01" },
          { status: "in_progress" },
          { status: "pending" },
          { status: "reassigned" },
        ],
      }),
    ],
    "2026-09-17"
  )
  assert.deepEqual(
    { done: row.done, inProgress: row.inProgress, notStarted: row.notStarted, pastDue: row.pastDue },
    { done: 1, inProgress: 1, notStarted: 1, pastDue: 1 }
  )
})
