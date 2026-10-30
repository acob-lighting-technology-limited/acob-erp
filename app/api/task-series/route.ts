import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { checkRequestSize } from "@/lib/api/request-size"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { toLocalISODate } from "@/lib/utils/date"
import { resolveTaskCreateAuthority } from "@/lib/tasks/create-authority"
import { TaskSeriesBodySchema } from "@/lib/tasks/schemas"
import { assigneeOn, creationDateFor, describeSchedule, repeatsDue, upcomingDueDates } from "@/lib/tasks/recurrence"
import {
  TASK_SERIES_COLUMNS,
  createSeriesRepeats,
  loadSeriesAssignees,
  loadSeriesHolidays,
  notifySeriesRepeats,
  scheduleOf,
  seriesHolidayWindow,
  type TaskSeriesRow,
} from "@/lib/tasks/series"

const log = logger("task-series-route")

/**
 * Recurring task series visible to the caller.
 *
 * Admins see every series; a lead sees their departments'; anyone else sees
 * only the series they hold or held. Read with the service role and filtered
 * here, the way GET /api/tasks scopes tasks.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const url = new URL(request.url)
    const statusFilter = url.searchParams.get("status")
    // ?mine=1 is the staff /tasks view: only series this person holds now, even for a lead.
    const mine = url.searchParams.get("mine") === "1"

    const scope = await getRequestScope()
    const scopedDepts = mine ? [] : scope ? getScopedDepartments(scope) : []

    let query = dataClient.from("task_series").select(TASK_SERIES_COLUMNS).order("created_at", { ascending: false })
    if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter)

    if (scopedDepts !== null && scopedDepts.length > 0) {
      query = query.in("department", scopedDepts)
    } else if (scopedDepts !== null) {
      // Not a lead or admin: only series this person holds or held.
      const { data: held } = await dataClient
        .from("task_series_assignees")
        .select("series_id")
        .eq("assigned_to", user.id)
      const ids = Array.from(new Set(((held || []) as Array<{ series_id: string }>).map((row) => row.series_id)))
      if (ids.length === 0) return NextResponse.json({ data: [] })
      query = query.in("id", ids)
    }

    const { data, error } = await query.returns<TaskSeriesRow[]>()
    if (error) {
      log.error({ err: error }, "Failed to list task series")
      return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 500)
    }

    const rows = data || []
    const today = toLocalISODate()
    const assignees = await loadSeriesAssignees(
      dataClient,
      rows.map((row) => row.id)
    )
    const holderIds = Array.from(
      new Set(Array.from(assignees.values()).flatMap((list) => list.map((a) => a.assigned_to)))
    )
    const { data: people } = holderIds.length
      ? await dataClient.from("profiles").select("id, first_name, last_name").in("id", holderIds)
      : { data: [] }
    const holderProfiles = (people || []) as Array<{ id: string; first_name: string | null; last_name: string | null }>
    const personById = new Map(holderProfiles.map((p) => [p.id, p]))

    const visible = mine ? rows.filter((row) => assigneeOn(assignees.get(row.id) ?? [], today) === user.id) : rows

    // The task lists show a "Scheduled" row for a series with no open repeat
    // yet, so they need its KPI and the day its next repeat will be created.
    const kpiIds = Array.from(new Set(visible.map((row) => row.kpi_id).filter((id): id is string => Boolean(id))))
    const { data: kpis } = kpiIds.length
      ? await dataClient.from("corporate_kpis").select("id, measure").in("id", kpiIds)
      : { data: [] }
    const kpiMeasure = new Map(((kpis || []) as Array<{ id: string; measure: string }>).map((k) => [k.id, k.measure]))
    const holidays = await loadSeriesHolidays(dataClient, ...seriesHolidayWindow(today))

    return NextResponse.json({
      data: visible.map((row) => {
        const holder = assigneeOn(assignees.get(row.id) ?? [], today)
        const person = holder ? personById.get(holder) : undefined
        const nextDue =
          row.status === "ended" ? null : (upcomingDueDates(scheduleOf(row), today, 1, holidays)[0] ?? null)
        return {
          ...row,
          schedule_label: describeSchedule(row),
          current_assignee: holder,
          current_assignee_name: person ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() : null,
          current_assignee_first_name: person?.first_name ?? null,
          current_assignee_last_name: person?.last_name ?? null,
          kpi_measure: row.kpi_id ? (kpiMeasure.get(row.kpi_id) ?? null) : null,
          next_due: nextDue,
          next_created: nextDue ? creationDateFor(row.frequency, nextDue, row.start_date, holidays) : null,
        }
      }),
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task series GET")
    return apiError("Failed to fetch recurring tasks", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}

/**
 * Creates a recurring task: one series per assignee, exactly as picking three
 * people for a one-off task creates three tasks. If the first repeat is
 * already due for creation it is made straight away, so the lead sees it.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(`task-series-create:${getClientId(request)}`, { limit: 20, windowSec: 60 })
    if (!rl.allowed) {
      return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

    const sizeError = checkRequestSize(request)
    if (sizeError) return sizeError

    const parsed = TaskSeriesBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Validation failed",
        ApiErrorCode.VALIDATION_ERROR,
        400,
        parsed.error.issues
      )
    }
    const payload = parsed.data

    const authority = await resolveTaskCreateAuthority(supabase, user.id, payload)
    if (!authority.ok) return authority.response
    const { resolvedDepartment, targetUserIds } = authority

    const today = toLocalISODate()
    if (payload.start_date < today) {
      return apiError("A recurring task cannot start in the past", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const [holidayStart, holidayEnd] = seriesHolidayWindow(today)
    const holidays = await loadSeriesHolidays(dataClient, holidayStart, holidayEnd)

    const scheduleFields = {
      frequency: payload.frequency,
      weekday: payload.frequency === "weekly" ? (payload.weekday ?? null) : null,
      month_mode:
        payload.frequency === "monthly" || payload.frequency === "yearly" ? (payload.month_mode ?? null) : null,
      month_day:
        (payload.frequency === "monthly" || payload.frequency === "yearly") && payload.month_mode === "day"
          ? (payload.month_day ?? null)
          : null,
      year_month: payload.frequency === "yearly" ? (payload.year_month ?? null) : null,
      start_date: payload.start_date,
      end_date: payload.end_date ?? null,
    }

    if (upcomingDueDates(scheduleFields, payload.start_date, 1, holidays).length === 0) {
      return apiError(
        "This schedule has no due dates between its start and end dates",
        ApiErrorCode.VALIDATION_ERROR,
        400
      )
    }

    const seriesRows = targetUserIds.map(() => ({
      title: payload.title,
      description: payload.description || null,
      priority: payload.priority,
      department: resolvedDepartment,
      kpi_id: payload.kpi_id,
      goal_id: payload.goal_id || null,
      project_id: payload.project_id || null,
      plan_id: payload.plan_id || null,
      portfolio_id: payload.portfolio_id || null,
      weight: payload.weight,
      ...scheduleFields,
      status: "active",
      created_by: user.id,
      updated_by: user.id,
    }))

    const { data: created, error: insertError } = await dataClient
      .from("task_series")
      .insert(seriesRows)
      .select(TASK_SERIES_COLUMNS)
      .returns<TaskSeriesRow[]>()
    if (insertError || !created || created.length !== targetUserIds.length) {
      log.error({ err: insertError }, "Failed to create task series")
      return apiError(insertError?.message || "Failed to create recurring task", ApiErrorCode.DATABASE_ERROR, 500)
    }

    const assigneeRows = created.map((series, index) => ({
      series_id: series.id,
      assigned_to: targetUserIds[index],
      effective_from: payload.start_date,
      created_by: user.id,
    }))
    const { error: assigneeError } = await dataClient.from("task_series_assignees").insert(assigneeRows)
    if (assigneeError) {
      // A series nobody holds would never create a task; take it back out.
      await dataClient
        .from("task_series")
        .delete()
        .in(
          "id",
          created.map((s) => s.id)
        )
      log.error({ err: assigneeError }, "Failed to record series assignees")
      return apiError("Failed to create recurring task", ApiErrorCode.DATABASE_ERROR, 500)
    }

    let firstRepeats = 0
    const toNotify: Array<{ series: TaskSeriesRow; rows: Awaited<ReturnType<typeof createSeriesRepeats>> }> = []
    for (const [index, series] of created.entries()) {
      const holders = [{ assigned_to: targetUserIds[index], effective_from: payload.start_date }]
      const rows = await createSeriesRepeats(
        dataClient,
        series,
        holders,
        repeatsDue(scheduleOf(series), {}, today, holidays)
      )
      firstRepeats += rows.length
      toNotify.push({ series, rows })
    }

    // For the "set up" message: when the first task is due, and the day it is
    // created if it was not made just now. Every series here shares one schedule.
    const fromIso = payload.start_date > today ? payload.start_date : today
    const firstDue = upcomingDueDates(scheduleOf(created[0]), fromIso, 1, holidays)[0] ?? null
    const firstCreated =
      firstDue && firstRepeats === 0
        ? creationDateFor(created[0].frequency, firstDue, created[0].start_date, holidays)
        : null

    await writeAuditLog(
      supabase,
      {
        action: "task_series.create",
        entityType: "task_series",
        entityId: created[0].id,
        newValues: {
          title: payload.title,
          frequency: payload.frequency,
          start_date: payload.start_date,
          end_date: payload.end_date ?? null,
          assignees: targetUserIds,
          series_ids: created.map((s) => s.id),
        },
        context: { actorId: user.id, source: "api", route: "/api/task-series" },
      },
      { failOpen: true }
    )

    // Notifications and email after the response, as task creation does.
    after(async () => {
      for (const { series, rows } of toNotify) {
        await notifySeriesRepeats(dataClient, series, rows)
      }
    })

    return NextResponse.json(
      { data: created[0], createdCount: created.length, firstRepeats, firstDue, firstCreated },
      { status: 201 }
    )
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task series POST")
    return apiError("Failed to create recurring task", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}
