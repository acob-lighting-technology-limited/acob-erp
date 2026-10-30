import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { checkRequestSize } from "@/lib/api/request-size"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getRequestScope } from "@/lib/admin/api-scope"
import { canAssignToDepartment, canAssignToProfile } from "@/lib/tasks/assignment-scope"
import { toLocalISODate } from "@/lib/utils/date"
import { TaskSeriesActionSchema } from "@/lib/tasks/schemas"
import { assigneeOn, describeSchedule, upcomingDueDates } from "@/lib/tasks/recurrence"
import {
  TASK_SERIES_COLUMNS,
  loadSeriesAssignees,
  loadSeriesHolidays,
  scheduleOf,
  seriesHolidayWindow,
  type TaskSeriesRow,
} from "@/lib/tasks/series"
import {
  SERIES_TASK_COLUMNS,
  applyEdit,
  applyEnd,
  applyPause,
  applyReassign,
  applyResume,
  notifySeriesChange,
  planPause,
  type SeriesTaskRow,
} from "@/lib/tasks/series-actions"

const log = logger("task-series-detail-route")

type ManagerProfile = {
  id: string
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

type Loaded = {
  series: TaskSeriesRow
  canManage: boolean
  profile: ManagerProfile | null
  isAdmin: boolean
}

/**
 * Loads a series and decides whether the caller may manage it: an admin, the
 * lead of its department, or whoever set it up. Holders may read it.
 */
async function loadForCaller(seriesId: string): Promise<Loaded | Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data: series } = await dataClient
    .from("task_series")
    .select(TASK_SERIES_COLUMNS)
    .eq("id", seriesId)
    .maybeSingle<TaskSeriesRow>()
  if (!series) return apiError("Recurring task not found", ApiErrorCode.NOT_FOUND, 404)

  const [{ data: profile }, scope, { data: held }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .maybeSingle<ManagerProfile>(),
    getRequestScope(),
    dataClient.from("task_series_assignees").select("id").eq("series_id", seriesId).eq("assigned_to", user.id).limit(1),
  ])

  const isAdmin = Boolean(scope?.isAdminLike && scope.scopeMode !== "lead")
  const leadsIt = Boolean(profile?.is_department_lead) && canAssignToDepartment(profile, series.department)
  const canManage = isAdmin || leadsIt || series.created_by === user.id
  const holds = Boolean(held && held.length > 0)

  if (!canManage && !holds) {
    return apiError("Forbidden: You do not have access to this recurring task", ApiErrorCode.FORBIDDEN, 403)
  }
  return { series, canManage, profile: profile ?? null, isAdmin }
}

async function loadSeriesTasks(seriesId: string): Promise<SeriesTaskRow[]> {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await dataClient
    .from("tasks")
    .select(SERIES_TASK_COLUMNS)
    .eq("series_id", seriesId)
    .eq("is_archived", false)
    .order("occurrence_date", { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as SeriesTaskRow[]
}

/** One series: its schedule, who held it when, its repeats so far and the next due dates. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const loaded = await loadForCaller(id)
    if (loaded instanceof Response) return loaded
    const { series, canManage } = loaded

    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const today = toLocalISODate()

    const [assigneesBySeries, taskRes] = await Promise.all([
      loadSeriesAssignees(dataClient, [series.id]),
      dataClient
        .from("tasks")
        .select(`${SERIES_TASK_COLUMNS}, weight, rating, work_item_number, completed_at`)
        .eq("series_id", series.id)
        .eq("is_archived", false)
        .order("occurrence_date", { ascending: false }),
    ])
    const assignees = assigneesBySeries.get(series.id) ?? []

    const personIds = Array.from(
      new Set([
        ...assignees.map((a) => a.assigned_to),
        ...((taskRes.data || []) as SeriesTaskRow[]).map((t) => t.assigned_to).filter(Boolean),
      ] as string[])
    )
    const { data: people } = personIds.length
      ? await dataClient.from("profiles").select("id, first_name, last_name, department").in("id", personIds)
      : { data: [] }

    const [holidayStart, holidayEnd] = seriesHolidayWindow(today)
    const holidays = await loadSeriesHolidays(dataClient, holidayStart, holidayEnd)

    return NextResponse.json({
      data: {
        series,
        schedule_label: describeSchedule(series),
        can_manage: canManage,
        current_assignee: assigneeOn(assignees, today),
        assignees,
        people: people || [],
        tasks: taskRes.data || [],
        upcoming: series.status === "ended" ? [] : upcomingDueDates(scheduleOf(series), today, 5, holidays),
      },
    })
  } catch (error) {
    log.error({ err: String(error), seriesId: id }, "Unhandled error in task series GET")
    return apiError("Failed to load recurring task", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}

/** Edit, reassign, pause, resume or end a series. */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  try {
    const rl = await rateLimit(`task-series-update:${getClientId(request)}`, { limit: 30, windowSec: 60 })
    if (!rl.allowed) {
      return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
    }
    const sizeError = checkRequestSize(request)
    if (sizeError) return sizeError

    const parsed = TaskSeriesActionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Validation failed",
        ApiErrorCode.VALIDATION_ERROR,
        400,
        parsed.error.issues
      )
    }
    const input = parsed.data

    const loaded = await loadForCaller(id)
    if (loaded instanceof Response) return loaded
    const { series, canManage, profile, isAdmin } = loaded
    if (!canManage) {
      return apiError(
        "Only the department lead, an administrator or whoever set it up can change a recurring task",
        ApiErrorCode.FORBIDDEN,
        403
      )
    }
    if (series.status === "ended") {
      return apiError("This recurring task has ended", ApiErrorCode.INVALID_STATE, 400)
    }

    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const actor = { id: profile?.id as string }
    const today = toLocalISODate()
    const tasks = await loadSeriesTasks(series.id)
    const assigneesBySeries = await loadSeriesAssignees(dataClient, [series.id])
    const assignees = assigneesBySeries.get(series.id) ?? []
    const holder = assigneeOn(assignees, today)
    const [holidayStart, holidayEnd] = seriesHolidayWindow(today, series.paused_from)
    const holidays = await loadSeriesHolidays(dataClient, holidayStart, holidayEnd)

    let result: Record<string, unknown> = {}

    switch (input.action) {
      case "edit": {
        if (input.end_date && input.end_date < series.start_date) {
          return apiError("The end date must be on or after the start date", ApiErrorCode.VALIDATION_ERROR, 400)
        }
        if (input.end_date && input.end_date < today) {
          return apiError("The end date cannot be in the past", ApiErrorCode.VALIDATION_ERROR, 400)
        }
        result = await applyEdit(dataClient, series, tasks, input, actor)
        break
      }

      case "reassign": {
        if (input.effective_from < today) {
          return apiError("A reassignment cannot start in the past", ApiErrorCode.VALIDATION_ERROR, 400)
        }
        if (!isAdmin) {
          const { data: target } = await dataClient
            .from("profiles")
            .select("id, department")
            .eq("id", input.assigned_to)
            .maybeSingle<{ id: string; department: string | null }>()
          if (!target || !canAssignToProfile(profile, target)) {
            return apiError(
              "You can only assign tasks to users within your departmental scope",
              ApiErrorCode.FORBIDDEN,
              403
            )
          }
        }
        result = await applyReassign(
          dataClient,
          series,
          tasks,
          input.assigned_to,
          input.effective_from,
          input.move_open,
          actor
        )
        await notifySeriesChange(
          series,
          actor,
          [input.assigned_to],
          "Recurring task assigned to you",
          `${series.title} (${describeSchedule(series).toLowerCase()}) is yours from ${input.effective_from}.`
        )
        if (holder && holder !== input.assigned_to) {
          await notifySeriesChange(
            series,
            actor,
            [holder],
            "Recurring task handed over",
            `${series.title} moves to someone else from ${input.effective_from}.`
          )
        }
        break
      }

      case "pause": {
        const until = input.until ?? null
        if (input.from < today) {
          return apiError("A pause cannot start in the past", ApiErrorCode.VALIDATION_ERROR, 400)
        }
        if (until && until < input.from) {
          return apiError("The pause must end on or after the day it starts", ApiErrorCode.VALIDATION_ERROR, 400)
        }
        if (series.status === "paused") {
          return apiError("This recurring task is already paused", ApiErrorCode.INVALID_STATE, 400)
        }
        const plan = planPause(series.frequency, tasks, input.from, until, holidays)
        const preview = {
          skip: plan.skip.map((t) => ({ id: t.id, due: t.task_end_date || t.due_date })),
          move: plan.move.map(({ task, due }) => ({ id: task.id, from: task.task_end_date || task.due_date, to: due })),
          hold: plan.hold.map((t) => ({ id: t.id, due: t.task_end_date || t.due_date })),
        }
        // The heads-up: what the pause will do, before anything is changed.
        if (!input.confirm) {
          return NextResponse.json({ data: { preview, applied: false } })
        }
        result = { ...(await applyPause(dataClient, series, plan, input.from, until, actor)), preview }
        await notifySeriesChange(
          series,
          actor,
          [holder],
          "Recurring task paused",
          `${series.title} is paused ${until ? `from ${input.from} to ${until}` : `from ${input.from} until it is resumed`}.`
        )
        break
      }

      case "resume": {
        if (series.status !== "paused") {
          return apiError("This recurring task is not paused", ApiErrorCode.INVALID_STATE, 400)
        }
        result = await applyResume(dataClient, series, assignees, tasks, today, holidays, actor)
        await notifySeriesChange(series, actor, [holder], "Recurring task resumed", `${series.title} has resumed.`)
        break
      }

      case "end": {
        result = await applyEnd(dataClient, series, tasks, today, input.reason, input.note, actor)
        await notifySeriesChange(
          series,
          actor,
          [holder],
          "Recurring task ended",
          `${series.title} has ended - ${input.reason === "completed_early" ? "completed early" : "no longer needed"}.`
        )
        break
      }
    }

    await writeAuditLog(
      supabase,
      {
        action: `task_series.${input.action}`,
        entityType: "task_series",
        entityId: series.id,
        newValues: { ...input, result },
        context: { actorId: actor.id, source: "api", route: `/api/task-series/${series.id}` },
      },
      { failOpen: true }
    )

    const { data: updated } = await dataClient
      .from("task_series")
      .select(TASK_SERIES_COLUMNS)
      .eq("id", series.id)
      .maybeSingle<TaskSeriesRow>()

    return NextResponse.json({ data: { series: updated, result, applied: true } })
  } catch (error) {
    log.error({ err: String(error), seriesId: id }, "Unhandled error in task series PATCH")
    return apiError("Failed to update recurring task", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}
