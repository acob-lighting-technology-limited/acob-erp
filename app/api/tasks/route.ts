import { NextRequest, NextResponse, after } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { checkRequestSize } from "@/lib/api/request-size"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { TASK_WEIGHT_MAX, TASK_WEIGHT_MIN } from "@/lib/tasks/scoring"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { resolveTaskCreateAuthority } from "@/lib/tasks/create-authority"
import { TASK_STATUSES, TASK_ASSIGNMENT_TYPES } from "@/lib/tasks/constants"
import { sendTaskEmail } from "@/lib/tasks/mailer"
import { taskDeadlineWindowError } from "@/lib/tasks/deadline-window"
import { addIsoDays, type HolidaySet } from "@/lib/hr/leave-days"
import { getHolidaySet } from "@/lib/hr/leave-workflow"
import { toLocalISODate } from "@/lib/utils/date"
import type { Task, TaskPersonSummary } from "@/types/task"
import { createNotification } from "@/lib/notifications/create"
import { TaskBodySchema } from "@/lib/tasks/schemas"
import { executeCreateTask } from "@/lib/tasks/create-task"
import { loadWorkLinkNames } from "@/lib/tasks/work-links"
import { withSeriesFrequency } from "@/lib/tasks/series-links"

const log = logger("tasks-route")

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

    const scope = await getRequestScope()
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const scopedDepts = getScopedDepartments(scope)
    const url = new URL(request.url)
    const departmentFilter = url.searchParams.get("department")
    const statusFilter = url.searchParams.get("status")
    const goalFilter = url.searchParams.get("goal_id")
    const userFilter = url.searchParams.get("assigned_to")
    const includeArchived = url.searchParams.get("include_archived") === "true"

    let query = supabase
      .from("tasks")
      .select(
        `
        id,
        title,
        description,
        work_item_number,
        priority,
        status,
        due_date,
        started_at,
        completed_at,
        created_at,
        updated_at,
        source_type,
        source_id,
        assignment_type,
        assigned_to,
        assigned_by,
        assigned_at,
        department,
        goal_id,
        kpi_id,
        project_id,
        plan_id,
        portfolio_id,
        weight,
        rating,
        rated_by,
        rated_at,
        task_start_date,
        task_end_date,
        created_by,
        updated_by,
        reviewed_by,
        reviewed_at,
        reassigned_to,
        unable_to_complete_reason,
        failure_reason,
        extension_reason,
        cancel_reason,
        series_id,
        occurrence_date,
        is_archived,
        archived_by,
        archived_at
      `
      )
      .order("created_at", { ascending: false })

    if (!includeArchived) {
      query = query.eq("is_archived", false)
    }

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    if (goalFilter && goalFilter !== "all") {
      query = query.eq("goal_id", goalFilter)
    }

    if (departmentFilter && departmentFilter !== "all") {
      query = query.eq("department", departmentFilter)
    } else if (scopedDepts !== null) {
      if (scopedDepts.length === 0) {
        return NextResponse.json({ data: [] })
      }
      query = query.in("department", scopedDepts)
    }

    if (userFilter && userFilter !== "all") {
      query = query.eq("assigned_to", userFilter)
    }

    const { data: rawTasks, error } = await query
    if (error) {
      log.error({ err: error }, "Failed to fetch tasks")
      return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 500)
    }

    if (!rawTasks || rawTasks.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const tasks = await withSeriesFrequency(getServiceRoleClientOrFallback(supabase), rawTasks as Task[])

    // Collect all profile IDs to batch fetch
    const profileIds = new Set<string>()
    const goalIds = new Set<string>()
    const kpiIds = new Set<string>()
    const multipleTaskIds: string[] = []

    tasks.forEach((t) => {
      if (t.assigned_to) profileIds.add(t.assigned_to)
      if (t.assigned_by) profileIds.add(t.assigned_by)
      if (t.created_by) profileIds.add(t.created_by)
      if (t.updated_by) profileIds.add(t.updated_by)
      if (t.reviewed_by) profileIds.add(t.reviewed_by)
      if (t.reassigned_to) profileIds.add(t.reassigned_to)
      if (t.goal_id) goalIds.add(t.goal_id)
      if (t.kpi_id) kpiIds.add(t.kpi_id)
      if (t.assignment_type === "multiple") multipleTaskIds.push(t.id)
    })

    const dataClient = getServiceRoleClientOrFallback(supabase)

    const [profilesRes, goalsRes, kpisRes, assignmentsRes, { projectNames, portfolioNames }] = await Promise.all([
      profileIds.size > 0
        ? supabase.from("profiles").select("id, first_name, last_name, department").in("id", Array.from(profileIds))
        : { data: [] },
      goalIds.size > 0
        ? supabase.from("goals_objectives").select("id, title").in("id", Array.from(goalIds))
        : { data: [] },
      kpiIds.size > 0
        ? supabase
            .from("corporate_kpis")
            .select("id, measure, strategic_objective, strategic_priority")
            .in("id", Array.from(kpiIds))
        : { data: [] },
      multipleTaskIds.length > 0
        ? supabase.from("task_assignments").select("task_id, user_id").in("task_id", multipleTaskIds)
        : { data: [] },
      loadWorkLinkNames(dataClient, tasks),
    ])

    const profileMap = new Map<string, TaskPersonSummary>(
      ((profilesRes.data || []) as TaskPersonSummary[]).map((p) => [p.id, p])
    )
    const goalMap = new Map<string, string>(
      ((goalsRes.data || []) as Array<{ id: string; title: string }>).map((g) => [g.id, g.title])
    )
    type KpiInfo = { id: string; measure: string; strategic_objective: string; strategic_priority: string }
    const kpiMap = new Map<string, KpiInfo>(((kpisRes.data || []) as KpiInfo[]).map((k) => [k.id, k]))

    // Check if assignments referenced additional users
    const assignmentRows = (assignmentsRes.data || []) as Array<{ task_id: string; user_id: string }>
    const extraUserIds = assignmentRows.map((a) => a.user_id).filter((uid) => !profileMap.has(uid))
    if (extraUserIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, department")
        .in("id", Array.from(new Set(extraUserIds)))
      ;((extraProfiles || []) as TaskPersonSummary[]).forEach((p) => profileMap.set(p.id, p))
    }

    const assignmentsByTaskId = new Map<string, TaskPersonSummary[]>()
    assignmentRows.forEach((row) => {
      const p = profileMap.get(row.user_id)
      if (p) {
        const list = assignmentsByTaskId.get(row.task_id) || []
        list.push(p)
        assignmentsByTaskId.set(row.task_id, list)
      }
    })

    // Enrich tasks
    const enrichedTasks = tasks.map((t) => {
      const copy: Task = { ...t }
      if (t.assigned_to) copy.assigned_to_user = profileMap.get(t.assigned_to)
      if (t.assigned_by) copy.assigned_by_user = profileMap.get(t.assigned_by)
      if (t.created_by) copy.created_by_user = profileMap.get(t.created_by)
      if (t.updated_by) copy.updated_by_user = profileMap.get(t.updated_by)
      if (t.reviewed_by) copy.reviewed_by_user = profileMap.get(t.reviewed_by)
      if (t.reassigned_to) copy.reassigned_to_user = profileMap.get(t.reassigned_to)
      if (t.goal_id) copy.goal_title = goalMap.get(t.goal_id) || null
      if (t.project_id) copy.project_name = projectNames.get(t.project_id) || null
      if (t.portfolio_id) copy.portfolio_name = portfolioNames.get(t.portfolio_id) || null
      if (t.kpi_id) {
        const kpi = kpiMap.get(t.kpi_id)
        if (kpi) {
          copy.kpi_measure = kpi.measure
          copy.kpi_pillar = kpi.strategic_priority
          copy.kpi_objective = kpi.strategic_objective
          if (!copy.goal_title) {
            copy.goal_title = kpi.strategic_objective
          }
        }
      }
      if (t.assignment_type === "multiple") {
        copy.assigned_users = assignmentsByTaskId.get(t.id) || []
      }
      return copy
    })

    return NextResponse.json({ data: enrichedTasks })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in tasks GET")
    return apiError("Failed to fetch tasks", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(`tasks-create:${getClientId(request)}`, { limit: 30, windowSec: 60 })
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

    const parsed = TaskBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Validation failed",
        ApiErrorCode.VALIDATION_ERROR,
        400,
        parsed.error.issues
      )
    }

    const result = await executeCreateTask(supabase, user.id, parsed.data)
    if (result.error) {
      return apiError(result.error, ApiErrorCode.VALIDATION_ERROR, result.status || 400)
    }

    return NextResponse.json({ data: result.data, createdCount: result.createdCount }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in tasks POST")
    return apiError("Failed to create task", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}
