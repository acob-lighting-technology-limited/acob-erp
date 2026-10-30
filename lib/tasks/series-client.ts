/**
 * Browser side of recurring tasks: turning the task form into a series, and
 * the shapes the series API returns. Every place that creates tasks from
 * TaskFormDialog goes through createSeriesFromForm when "Repeat" is set, so
 * a recurring task is saved the same way whichever screen made it.
 */

import { apiJson } from "@/lib/api-client"
import type { SeriesFrequency, SeriesMonthMode } from "@/lib/tasks/recurrence"

/**
 * "" means not chosen yet. A new task starts there on purpose: Repeat has no
 * default, so whoever creates a task decides whether it repeats before the
 * dates appear, rather than leaving a new feature unnoticed.
 */
export type RepeatChoice = "" | "none" | SeriesFrequency

/** The repeat fields TaskFormDialog collects; all optional so existing forms need no change. */
export type RepeatFormFields = {
  repeat?: RepeatChoice
  repeat_weekday?: number
  repeat_month_mode?: SeriesMonthMode
  repeat_month_day?: number
  repeat_year_month?: number
  /** Empty means the series never ends. */
  repeat_end_date?: string
}

export const DEFAULT_REPEAT_FIELDS: Required<RepeatFormFields> = {
  repeat: "",
  repeat_weekday: 5,
  repeat_month_mode: "last_day",
  repeat_month_day: 1,
  repeat_year_month: 12,
  repeat_end_date: "",
}

export function isRepeating(form: RepeatFormFields): boolean {
  return Boolean(form.repeat && form.repeat !== "none")
}

type SeriesFormSource = RepeatFormFields & {
  title: string
  description: string
  priority: string
  department: string
  assigned_to: string
  assigned_users: string[]
  goal_id: string
  kpi_id: string
  project_id: string
  plan_id: string
  portfolio_id: string
  weight: number
  task_start_date: string
}

/** The schedule part of a series, from the form's repeat fields. */
export function scheduleFromForm(form: RepeatFormFields & { task_start_date: string }) {
  const frequency = (isRepeating(form) ? form.repeat : "monthly") as SeriesFrequency
  const usesMonth = frequency === "monthly" || frequency === "yearly"
  const monthMode = form.repeat_month_mode ?? DEFAULT_REPEAT_FIELDS.repeat_month_mode
  return {
    frequency,
    weekday: frequency === "weekly" ? (form.repeat_weekday ?? DEFAULT_REPEAT_FIELDS.repeat_weekday) : null,
    month_mode: usesMonth ? monthMode : null,
    month_day: usesMonth && monthMode === "day" ? (form.repeat_month_day ?? 1) : null,
    year_month: frequency === "yearly" ? (form.repeat_year_month ?? DEFAULT_REPEAT_FIELDS.repeat_year_month) : null,
    start_date: form.task_start_date,
    end_date: form.repeat_end_date || null,
  }
}

/**
 * Creates a recurring task from the task form. `fixed` carries what the
 * opening screen fixes, such as a project or portfolio.
 */
export async function createSeriesFromForm(
  form: SeriesFormSource,
  fixed: { project_id?: string | null; plan_id?: string | null; portfolio_id?: string | null } = {}
): Promise<{ createdCount: number; firstRepeats: number }> {
  const projectId = fixed.project_id !== undefined ? fixed.project_id : form.project_id || null
  const portfolioId = fixed.portfolio_id !== undefined ? fixed.portfolio_id : form.portfolio_id || null
  const payload = await apiJson<{ createdCount?: number; firstRepeats?: number }>("/api/task-series", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      department: form.department || null,
      assigned_to: form.assigned_to || null,
      assigned_users: form.assigned_users || [],
      goal_id: form.goal_id || null,
      kpi_id: form.kpi_id || null,
      project_id: projectId,
      plan_id: fixed.plan_id !== undefined ? fixed.plan_id : form.plan_id || null,
      portfolio_id: projectId ? null : portfolioId,
      weight: form.weight,
      ...scheduleFromForm(form),
    }),
  })
  return { createdCount: payload.createdCount ?? 1, firstRepeats: payload.firstRepeats ?? 0 }
}

/** The toast after creating a series. */
export function seriesCreatedMessage({ createdCount }: { createdCount: number }): string {
  return createdCount > 1
    ? `Recurring task set up for ${createdCount} people`
    : "Recurring task set up — each repeat is created ahead of its due date"
}

// ── API shapes ─────────────────────────────────────────────────────────

export type SeriesDetailTask = {
  id: string
  title: string
  status: string
  assigned_to: string | null
  due_date: string | null
  task_end_date: string | null
  occurrence_date: string | null
  weight: number | null
  rating: number | null
  work_item_number: string | null
  completed_at: string | null
}

export type SeriesDetail = {
  series: {
    id: string
    title: string
    description: string | null
    department: string | null
    weight: number
    frequency: SeriesFrequency
    start_date: string
    end_date: string | null
    status: "active" | "paused" | "ended"
    paused_from: string | null
    paused_until: string | null
    end_reason: string | null
    created_by: string | null
  }
  schedule_label: string
  can_manage: boolean
  current_assignee: string | null
  assignees: Array<{ assigned_to: string; effective_from: string }>
  people: Array<{ id: string; first_name: string | null; last_name: string | null; department: string | null }>
  tasks: SeriesDetailTask[]
  upcoming: string[]
}

export type PausePreview = {
  skip: Array<{ id: string; due: string | null }>
  move: Array<{ id: string; from: string | null; to: string }>
  hold: Array<{ id: string; due: string | null }>
}

/** A row of GET /api/task-series: the series plus who holds it now and when it is next due. */
export type SeriesListRow = {
  id: string
  title: string
  department: string | null
  frequency: SeriesFrequency
  start_date: string
  end_date: string | null
  status: "active" | "paused" | "ended"
  schedule_label: string
  current_assignee: string | null
  current_assignee_name: string | null
  current_assignee_first_name: string | null
  current_assignee_last_name: string | null
  description: string | null
  priority: string
  weight: number
  kpi_id: string | null
  kpi_measure: string | null
  created_at: string
  next_due: string | null
  /** The day the next repeat will be created, for the "Scheduled" row in the task lists. */
  next_created: string | null
}

/** Prefix of every series list query, mine or not, so one invalidation refreshes them all. */
export const seriesListKey = ["task-series", "list"] as const
export const seriesDetailKey = (seriesId: string) => ["task-series", seriesId] as const

/** `mine` limits the list to series the viewer holds now, for the staff /tasks page. */
export async function listSeries(mine = false): Promise<SeriesListRow[]> {
  const payload = await apiJson<{ data?: SeriesListRow[] }>(`/api/task-series${mine ? "?mine=1" : ""}`, {
    cache: "no-store",
  })
  return payload.data ?? []
}

export async function fetchSeriesDetail(seriesId: string): Promise<SeriesDetail> {
  const payload = await apiJson<{ data: SeriesDetail }>(`/api/task-series/${seriesId}`, { cache: "no-store" })
  return payload.data
}

export async function patchSeries<T = { applied: boolean }>(
  seriesId: string,
  body: Record<string, unknown>
): Promise<T> {
  const payload = await apiJson<{ data: T }>(`/api/task-series/${seriesId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return payload.data
}
