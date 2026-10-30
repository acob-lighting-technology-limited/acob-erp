/**
 * "Scheduled" rows: a recurring series shown in the task lists before its
 * next repeat exists. A monthly series set up today has no task until 5
 * working days before its first due date, so without these the series would
 * be missing from All Tasks and My Tasks for weeks.
 *
 * A scheduled row is NOT a task. It has no task id, so it must never reach a
 * task action (edit, review, archive, status change), an export, the stat
 * cards or the KPI - callers add these rows to the table's data only, and
 * route a click on one to the series panel.
 */

import type { Task } from "@/types/task"
import type { SeriesListRow } from "@/lib/tasks/series-client"

export const SCHEDULED_STATUS = "scheduled"
const SCHEDULED_ID_PREFIX = "scheduled:"
// Work still waiting on someone: while a repeat is open, the series already shows through it.
const OPEN_STATUSES = new Set(["pending", "in_progress", "submitted_for_review"])

export function isScheduledTask(task: Pick<Task, "id">): boolean {
  return task.id.startsWith(SCHEDULED_ID_PREFIX)
}

/**
 * One row per active series with no open repeat among `tasks`. Daily series
 * are left out: their next repeat is created the morning it is due, so a
 * scheduled row would only ever stand in for a day.
 */
export function scheduledSeriesTasks(series: SeriesListRow[], tasks: Task[]): Task[] {
  const withOpenRepeat = new Set(
    tasks.filter((t) => t.series_id && OPEN_STATUSES.has(t.status)).map((t) => t.series_id as string)
  )
  return series
    .filter((s) => s.status === "active" && s.frequency !== "working_daily" && s.next_due && !withOpenRepeat.has(s.id))
    .map((s) => ({
      id: `${SCHEDULED_ID_PREFIX}${s.id}`,
      title: s.title,
      description: s.description,
      priority: s.priority,
      status: SCHEDULED_STATUS,
      due_date: s.next_due,
      task_start_date: s.next_created,
      created_at: s.created_at,
      department: s.department,
      assigned_to: s.current_assignee,
      assigned_to_user: s.current_assignee
        ? {
            id: s.current_assignee,
            first_name: s.current_assignee_first_name ?? "",
            last_name: s.current_assignee_last_name ?? "",
          }
        : undefined,
      kpi_id: s.kpi_id,
      kpi_measure: s.kpi_measure,
      weight: s.weight,
      series_id: s.id,
      series_frequency: s.frequency,
      occurrence_date: s.next_due,
      is_archived: false,
    }))
}
