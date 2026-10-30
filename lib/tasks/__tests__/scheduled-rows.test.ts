import { strict as assert } from "node:assert"
import { test } from "node:test"
import { isScheduledTask, scheduledSeriesTasks } from "../scheduled-rows"
import type { SeriesListRow } from "../series-client"
import type { Task } from "@/types/task"

function series(id: string, overrides: Partial<SeriesListRow> = {}): SeriesListRow {
  return {
    id,
    title: "Starlink payment requisition",
    department: "IT and Communications",
    frequency: "monthly",
    start_date: "2026-11-01",
    end_date: null,
    status: "active",
    schedule_label: "Monthly on day 25",
    current_assignee: "ada",
    current_assignee_name: "Ada Obi",
    current_assignee_first_name: "Ada",
    current_assignee_last_name: "Obi",
    description: null,
    priority: "medium",
    weight: 3,
    kpi_id: null,
    kpi_measure: null,
    created_at: "2026-10-30T10:28:23Z",
    next_due: "2026-11-25",
    next_created: "2026-11-18",
    ...overrides,
  }
}

function task(seriesId: string, status: string): Task {
  return {
    id: `t-${seriesId}-${status}`,
    title: "x",
    priority: "medium",
    status,
    created_at: "",
    weight: 3,
    series_id: seriesId,
  }
}

test("a series with no task yet becomes one scheduled row, due on its next date", () => {
  const rows = scheduledSeriesTasks([series("s1")], [])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, "scheduled")
  assert.equal(rows[0].due_date, "2026-11-25")
  assert.equal(rows[0].task_start_date, "2026-11-18")
  assert.equal(rows[0].series_id, "s1")
  assert.equal(rows[0].assigned_to_user?.first_name, "Ada")
  assert.ok(isScheduledTask(rows[0]))
})

test("an open repeat already shows the series, so no scheduled row", () => {
  for (const status of ["pending", "in_progress", "submitted_for_review"]) {
    assert.equal(scheduledSeriesTasks([series("s1")], [task("s1", status)]).length, 0, status)
  }
})

test("once every repeat is closed, the next one shows as scheduled", () => {
  assert.equal(scheduledSeriesTasks([series("s1")], [task("s1", "completed")]).length, 1)
})

test("paused, ended and daily series, and series with no next date, get no row", () => {
  const rows = scheduledSeriesTasks(
    [
      series("paused", { status: "paused" }),
      series("ended", { status: "ended" }),
      series("daily", { frequency: "working_daily" }),
      series("none", { next_due: null }),
    ],
    []
  )
  assert.equal(rows.length, 0)
})

test("real tasks are never mistaken for scheduled rows", () => {
  assert.equal(isScheduledTask(task("s1", "pending")), false)
})
