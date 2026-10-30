/**
 * What a lead can do to a task series once it exists: edit, reassign, pause,
 * resume and end. Called by PATCH /api/task-series/[id] with the service-role
 * client after it has checked the caller may manage the series.
 *
 * The decisions are pure functions in lib/tasks/series-plan.ts so they can be
 * tested; the apply* functions here only carry them out.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { firstWorkingDayOnOrAfter, type HolidaySet } from "@/lib/hr/leave-days"
import { createNotification } from "@/lib/notifications/create"
import { taskDeadline } from "@/lib/tasks/overdue"
import { pauseSkipsRepeats, repeatsDue, repeatsHeldByPause, type SeriesAssigneeRow } from "@/lib/tasks/recurrence"
import { createSeriesRepeats, notifySeriesRepeats, scheduleOf, type TaskSeriesRow } from "@/lib/tasks/series"
import {
  isOpenRepeat,
  repeatsToCloseAfter,
  repeatsToHandOver,
  type PausePlan,
  type SeriesTaskRow,
} from "@/lib/tasks/series-plan"

export { SERIES_TASK_COLUMNS, planPause, type PausePlan, type SeriesTaskRow } from "@/lib/tasks/series-plan"

const log = logger("task-series-actions")

// ── Carrying them out ──────────────────────────────────────────────────

type Actor = { id: string }

async function noteOnTasks(
  client: SupabaseClient,
  actor: Actor,
  tasks: SeriesTaskRow[],
  content: string,
  newStatus?: string
): Promise<void> {
  if (tasks.length === 0) return
  const { error } = await client.from("task_updates").insert(
    tasks.map((task) => ({
      task_id: task.id,
      user_id: actor.id,
      update_type: newStatus ? "status_change" : "comment",
      content,
      old_value: newStatus ? task.status : null,
      new_value: newStatus ?? null,
    }))
  )
  if (error) log.error({ err: error.message }, "Failed to record series note on tasks")
}

/** Closes repeats as not planned. Cancelled work is neutral for the KPI. */
async function closeAsNotPlanned(
  client: SupabaseClient,
  actor: Actor,
  tasks: SeriesTaskRow[],
  note: string
): Promise<number> {
  if (tasks.length === 0) return 0
  const now = new Date().toISOString()
  const { error } = await client
    .from("tasks")
    .update({
      status: "cancelled",
      cancel_reason: "not_planned",
      reviewed_by: actor.id,
      reviewed_at: now,
      updated_by: actor.id,
      updated_at: now,
    })
    .in(
      "id",
      tasks.map((task) => task.id)
    )
  if (error) throw new Error(error.message)
  await noteOnTasks(client, actor, tasks, note, "cancelled")
  return tasks.length
}

async function moveDeadline(
  client: SupabaseClient,
  actor: Actor,
  task: SeriesTaskRow,
  due: string,
  reason: string
): Promise<void> {
  const { error } = await client
    .from("tasks")
    .update({
      due_date: due,
      task_end_date: due,
      extension_reason: reason,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
  if (error) throw new Error(error.message)
  await noteOnTasks(client, actor, [task], `${reason}. New deadline ${due}.`)
}

async function updateSeries(client: SupabaseClient, seriesId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await client
    .from("task_series")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", seriesId)
  if (error) throw new Error(error.message)
}

/** Tells people about a change to a series they hold. */
export async function notifySeriesChange(
  series: TaskSeriesRow,
  actor: Actor,
  userIds: Array<string | null | undefined>,
  title: string,
  message: string
): Promise<void> {
  for (const userId of new Set(userIds.filter(Boolean) as string[])) {
    if (userId === actor.id) continue
    const { error } = await createNotification({
      p_user_id: userId,
      p_type: "task_updated",
      p_category: "tasks",
      p_title: title,
      p_message: message,
      p_priority: "normal",
      p_link_url: "/tasks/management",
      p_actor_id: actor.id,
      p_entity_type: "task_series",
      p_entity_id: series.id,
    })
    if (error) log.error({ err: String(error.message), seriesId: series.id }, "Series change notification failed")
  }
}

export async function applyPause(
  client: SupabaseClient,
  series: TaskSeriesRow,
  plan: PausePlan,
  from: string,
  until: string | null,
  actor: Actor
): Promise<{ skipped: number; moved: number; held: number }> {
  const window = until ? `${from} to ${until}` : `from ${from}`
  const skipped = await closeAsNotPlanned(client, actor, plan.skip, `Skipped: the series was paused ${window}`)
  for (const { task, due } of plan.move) {
    await moveDeadline(client, actor, task, due, `Series paused ${window}`)
  }
  await updateSeries(client, series.id, {
    status: "paused",
    paused_from: from,
    paused_until: until,
    updated_by: actor.id,
  })
  return { skipped, moved: plan.move.length, held: plan.hold.length }
}

export async function applyResume(
  client: SupabaseClient,
  series: TaskSeriesRow,
  assignees: SeriesAssigneeRow[],
  tasks: SeriesTaskRow[],
  todayIso: string,
  holidays: HolidaySet,
  actor: Actor
): Promise<{ created: number; moved: number }> {
  const pause = { paused_from: series.paused_from, paused_until: series.paused_until }
  const schedule = scheduleOf(series)

  // Repeats the pause held back but never created, now owed from today.
  const held = repeatsHeldByPause(schedule, pause, todayIso, holidays)

  // Repeats that existed when an open-ended pause began kept their old
  // deadlines; give them the same fresh one.
  let moved = 0
  if (series.paused_from && !pauseSkipsRepeats(series.frequency)) {
    const due = firstWorkingDayOnOrAfter(todayIso, holidays)
    for (const task of tasks) {
      const deadline = taskDeadline(task)
      if (!isOpenRepeat(task) || !deadline || deadline < series.paused_from || deadline >= todayIso) continue
      await moveDeadline(client, actor, task, due, "Series resumed after a pause")
      moved += 1
    }
  }

  await updateSeries(client, series.id, {
    status: "active",
    paused_from: null,
    paused_until: null,
    updated_by: actor.id,
  })

  const resumed: TaskSeriesRow = { ...series, status: "active", paused_from: null, paused_until: null }
  const dueNow = repeatsDue(schedule, {}, todayIso, holidays)
  const createdRows = await createSeriesRepeats(client, resumed, assignees, [...held, ...dueNow])
  await notifySeriesRepeats(client, resumed, createdRows)
  return { created: createdRows.length, moved }
}

export async function applyEnd(
  client: SupabaseClient,
  series: TaskSeriesRow,
  tasks: SeriesTaskRow[],
  todayIso: string,
  reason: "completed_early" | "no_longer_needed",
  note: string | undefined,
  actor: Actor
): Promise<{ closed: number }> {
  const label = reason === "completed_early" ? "completed early" : "no longer needed"
  const closed = await closeAsNotPlanned(
    client,
    actor,
    repeatsToCloseAfter(tasks, todayIso),
    `Closed: the series was ended (${label})${note ? ` - ${note}` : ""}`
  )
  const now = new Date().toISOString()
  await updateSeries(client, series.id, {
    status: "ended",
    end_reason: reason,
    ended_at: now,
    ended_by: actor.id,
    paused_from: null,
    paused_until: null,
    updated_by: actor.id,
  })
  return { closed }
}

export async function applyReassign(
  client: SupabaseClient,
  series: TaskSeriesRow,
  tasks: SeriesTaskRow[],
  newAssignee: string,
  effectiveFrom: string,
  moveOpen: boolean,
  actor: Actor
): Promise<{ moved: number }> {
  const { error: assigneeError } = await client
    .from("task_series_assignees")
    .upsert(
      { series_id: series.id, assigned_to: newAssignee, effective_from: effectiveFrom, created_by: actor.id },
      { onConflict: "series_id,effective_from" }
    )
  if (assigneeError) throw new Error(assigneeError.message)

  const handOver = repeatsToHandOver(tasks, newAssignee, effectiveFrom, moveOpen)
  if (handOver.length > 0) {
    const now = new Date().toISOString()
    const { error } = await client
      .from("tasks")
      .update({ assigned_to: newAssignee, assigned_at: now, updated_by: actor.id, updated_at: now })
      .in(
        "id",
        handOver.map((task) => task.id)
      )
    if (error) throw new Error(error.message)
    await noteOnTasks(client, actor, handOver, `Handed over with the recurring series from ${effectiveFrom}`)
  }
  await updateSeries(client, series.id, { updated_by: actor.id })
  return { moved: handOver.length }
}

export async function applyEdit(
  client: SupabaseClient,
  series: TaskSeriesRow,
  tasks: SeriesTaskRow[],
  changes: {
    title?: string
    description?: string | null
    priority?: string
    weight?: number
    kpi_id?: string
    goal_id?: string | null
    end_date?: string | null
  },
  actor: Actor
): Promise<{ closed: number }> {
  const values: Record<string, unknown> = { updated_by: actor.id }
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) values[key] = value
  }
  await updateSeries(client, series.id, values)

  // Pulling the end date in closes repeats already created past it.
  let closed = 0
  if (changes.end_date) {
    closed = await closeAsNotPlanned(
      client,
      actor,
      repeatsToCloseAfter(tasks, changes.end_date),
      `Closed: the series now ends on ${changes.end_date}`
    )
  }
  return { closed }
}
