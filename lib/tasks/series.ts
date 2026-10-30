/**
 * Server-side task series helpers: turning planned repeats into task rows,
 * and telling people about them.
 *
 * The date maths is in lib/tasks/recurrence.ts. This module is the one place
 * a repeat becomes a row, used by the nightly generator, by creating a series
 * whose first repeat is already due, and by resuming a paused one - so every
 * repeat is built the same way whichever of the three made it.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { addIsoDays, type HolidaySet } from "@/lib/hr/leave-days"
import { getHolidaySet } from "@/lib/hr/leave-workflow"
import { createNotification } from "@/lib/notifications/create"
import { sendTaskEmail } from "@/lib/tasks/mailer"
import {
  assigneeOn,
  describeSchedule,
  type PlannedRepeat,
  type SeriesAssigneeRow,
  type SeriesEndReason,
  type SeriesFrequency,
  type SeriesMonthMode,
  type SeriesSchedule,
  type SeriesStatus,
} from "@/lib/tasks/recurrence"

const log = logger("task-series")

export type TaskSeriesRow = {
  id: string
  title: string
  description: string | null
  priority: string
  department: string | null
  kpi_id: string | null
  goal_id: string | null
  project_id: string | null
  plan_id: string | null
  portfolio_id: string | null
  weight: number
  frequency: SeriesFrequency
  weekday: number | null
  month_mode: SeriesMonthMode | null
  month_day: number | null
  year_month: number | null
  start_date: string
  end_date: string | null
  status: SeriesStatus
  paused_from: string | null
  paused_until: string | null
  end_reason: SeriesEndReason | null
  ended_at: string | null
  ended_by: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  last_generated_at: string | null
}

export const TASK_SERIES_COLUMNS =
  "id, title, description, priority, department, kpi_id, goal_id, project_id, plan_id, portfolio_id, weight, " +
  "frequency, weekday, month_mode, month_day, year_month, start_date, end_date, status, paused_from, paused_until, " +
  "end_reason, ended_at, ended_by, created_by, updated_by, created_at, updated_at, last_generated_at"

export function scheduleOf(series: TaskSeriesRow): SeriesSchedule {
  return {
    frequency: series.frequency,
    weekday: series.weekday,
    month_mode: series.month_mode,
    month_day: series.month_day,
    year_month: series.year_month,
    start_date: series.start_date,
    end_date: series.end_date,
  }
}

/**
 * Public holidays for a window. A failed lookup falls back to weekends only:
 * a repeat due on a holiday is a nuisance, a generator that stops is not.
 */
export async function loadSeriesHolidays(
  client: SupabaseClient,
  startIso: string,
  endIso: string
): Promise<HolidaySet> {
  try {
    return await getHolidaySet(client, null, startIso, endIso)
  } catch (error) {
    log.error({ err: String(error) }, "Holiday lookup failed; repeats use weekends only")
    return new Set<string>()
  }
}

/** Holidays wide enough for any series question asked around `todayIso`. */
export function seriesHolidayWindow(todayIso: string, earliestIso?: string | null): [string, string] {
  const back = addIsoDays(todayIso, -60)
  return [earliestIso && earliestIso < back ? earliestIso : back, addIsoDays(todayIso, 800)]
}

export type CreatedRepeat = {
  id: string
  title: string
  assigned_to: string | null
  due_date: string | null
  occurrence_date: string | null
}

/**
 * Inserts the planned repeats as ordinary tasks. A repeat that already exists
 * is skipped by the (series_id, occurrence_date) unique constraint, so this is
 * safe to call twice with the same plan. Returns only the rows it created.
 */
export async function createSeriesRepeats(
  client: SupabaseClient,
  series: TaskSeriesRow,
  assignees: SeriesAssigneeRow[],
  planned: PlannedRepeat[]
): Promise<CreatedRepeat[]> {
  if (planned.length === 0) return []
  const now = new Date().toISOString()

  const rows = planned.flatMap((repeat) => {
    const assignee = assigneeOn(assignees, repeat.occurrence)
    if (!assignee) return []
    return [
      {
        title: series.title,
        description: series.description,
        priority: series.priority,
        status: "pending",
        due_date: repeat.due,
        task_end_date: repeat.due,
        task_start_date: repeat.created,
        department: series.department,
        assignment_type: "individual",
        assigned_to: assignee,
        assigned_by: series.created_by,
        assigned_at: now,
        created_by: series.created_by,
        updated_by: series.created_by,
        goal_id: series.goal_id,
        kpi_id: series.kpi_id,
        project_id: series.project_id,
        plan_id: series.plan_id,
        portfolio_id: series.portfolio_id,
        weight: series.weight,
        source_type: "manual",
        series_id: series.id,
        occurrence_date: repeat.occurrence,
      },
    ]
  })
  if (rows.length === 0) return []

  const { data, error } = await client
    .from("tasks")
    .upsert(rows, { onConflict: "series_id,occurrence_date", ignoreDuplicates: true })
    .select("id, title, assigned_to, due_date, occurrence_date")

  if (error) {
    log.error({ err: error, seriesId: series.id }, "Failed to create series repeats")
    throw new Error(error.message)
  }
  return (data || []) as CreatedRepeat[]
}

/**
 * Tells each assignee about their new repeats.
 *
 * A daily series would otherwise announce itself 22 times a month, so for
 * working_daily only a person's first repeat - the one that tells them the
 * routine is theirs - is notified and emailed. Changes to the series (a
 * reassignment, a pause, an end) are announced by the series API.
 */
export async function notifySeriesRepeats(
  client: SupabaseClient,
  series: TaskSeriesRow,
  created: CreatedRepeat[]
): Promise<number> {
  if (created.length === 0) return 0

  let toNotify = created.filter((row) => row.assigned_to && row.assigned_to !== series.created_by)
  if (series.frequency === "working_daily") {
    const createdIds = new Set(created.map((row) => row.id))
    const people = Array.from(new Set(toNotify.map((row) => row.assigned_to as string)))
    const { data: earlier } = await client
      .from("tasks")
      .select("id, assigned_to")
      .eq("series_id", series.id)
      .in("assigned_to", people)
    const alreadyHeld = new Set(
      ((earlier || []) as Array<{ id: string; assigned_to: string }>)
        .filter((row) => !createdIds.has(row.id))
        .map((row) => row.assigned_to)
    )
    const seen = new Set<string>()
    toNotify = toNotify.filter((row) => {
      const person = row.assigned_to as string
      if (alreadyHeld.has(person) || seen.has(person)) return false
      seen.add(person)
      return true
    })
  }

  const schedule = describeSchedule(series).toLowerCase()
  let sent = 0
  for (const row of toNotify) {
    const { error } = await createNotification({
      p_user_id: row.assigned_to as string,
      p_type: "task_assigned",
      p_category: "tasks",
      p_title: series.frequency === "working_daily" ? "New daily task assigned to you" : "Recurring task due",
      p_message: `${row.title} (repeats ${schedule}) - due ${row.due_date ?? "soon"}`,
      p_priority: series.priority === "urgent" ? "urgent" : series.priority === "high" ? "high" : "normal",
      p_link_url: "/tasks/management",
      p_actor_id: series.created_by,
      p_entity_type: "task",
      p_entity_id: row.id,
    })
    if (error) {
      log.error({ err: String(error.message), taskId: row.id }, "Repeat notification failed")
      continue
    }
    sent += 1
    await sendTaskEmail(client, {
      kind: "assigned",
      taskId: row.id,
      recipientIds: [row.assigned_to as string],
      replyToUserId: series.created_by,
    })
  }
  return sent
}

/** A series' dated holders, oldest first. */
export async function loadSeriesAssignees(
  client: SupabaseClient,
  seriesIds: string[]
): Promise<Map<string, SeriesAssigneeRow[]>> {
  const bySeries = new Map<string, SeriesAssigneeRow[]>()
  if (seriesIds.length === 0) return bySeries
  const { data, error } = await client
    .from("task_series_assignees")
    .select("series_id, assigned_to, effective_from")
    .in("series_id", seriesIds)
    .order("effective_from", { ascending: true })
  if (error) throw new Error(error.message)
  for (const row of (data || []) as Array<SeriesAssigneeRow & { series_id: string }>) {
    const list = bySeries.get(row.series_id) ?? []
    list.push({ assigned_to: row.assigned_to, effective_from: row.effective_from })
    bySeries.set(row.series_id, list)
  }
  return bySeries
}
