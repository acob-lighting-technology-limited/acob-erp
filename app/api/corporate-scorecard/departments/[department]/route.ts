import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import {
  computeAttainment,
  resolveEffectiveActual,
  type Direction,
  type MeasureType,
} from "@/lib/corporate-scorecard/attainment"

const log = logger("corporate-scorecard-department")

type AssignmentRow = {
  id: string
  kpi_id: string
  department: string
  role: "core" | "support"
  target_value: number | null
  target_unit: string | null
  department_target: string | null
  proposed_action: string | null
  corporate_kpis: {
    id: string
    source_sn: number
    perspective: string
    strategic_priority: string
    strategic_objective: string
    measure: string
    target_text: string
    measure_type: MeasureType
    direction: Direction
  } | null
}

type ActualRow = {
  kpi_id: string
  department: string
  actual_value: number | null
  milestones_completed: number | null
  milestones_total: number | null
  note: string | null
  is_override?: boolean | null
  recorded_at: string
}

type TaskRow = {
  id: string
  kpi_id: string | null
  department: string | null
  status: string | null
}

/**
 * GET /api/corporate-scorecard/departments/[department]
 *
 * One department's cascade (or all departments when department is "all"):
 * every KPI assigned with role, confirmed target, latest actual, live task auto-derivation,
 * and effective attainment.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ department: string }> }) {
  const params = await props.params
  const department = decodeURIComponent(params.department)

  const rl = await rateLimit(`corporate-scorecard-department:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const isAll = department.toLowerCase() === "all"

  let assignmentQuery = supabase
    .from("kpi_assignments")
    .select(
      `id, kpi_id, department, role, target_value, target_unit, department_target, proposed_action,
       corporate_kpis!inner (
         id, source_sn, perspective, strategic_priority, strategic_objective, measure, target_text, measure_type, direction
       )`
    )
    .eq("corporate_kpis.is_archived", false)

  if (!isAll) {
    assignmentQuery = assignmentQuery.eq("department", department)
  }

  const { data: assignments, error: assignmentError } = await assignmentQuery.returns<AssignmentRow[]>()

  if (assignmentError) {
    log.error({ err: assignmentError.message, department }, "Failed to load department KPI assignments")
    return apiError("Failed to load this department's scorecard", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const kpiIds = (assignments || []).map((a) => a.kpi_id)

  let actualQuery = supabase
    .from("kpi_actuals")
    .select("kpi_id, department, actual_value, milestones_completed, milestones_total, note, recorded_at, is_override")
    .in("kpi_id", kpiIds)
    .order("recorded_at", { ascending: false })

  if (!isAll) {
    actualQuery = actualQuery.eq("department", department)
  }

  let taskQuery = supabase
    .from("tasks")
    .select("id, kpi_id, department, status")
    .in("kpi_id", kpiIds)
    .eq("is_archived", false)

  if (!isAll) {
    taskQuery = taskQuery.eq("department", department)
  }

  const [{ data: actualRows }, { data: taskRows }] = await Promise.all([
    kpiIds.length > 0 ? actualQuery.returns<ActualRow[]>() : Promise.resolve({ data: [] as ActualRow[] }),
    kpiIds.length > 0 ? taskQuery.returns<TaskRow[]>() : Promise.resolve({ data: [] as TaskRow[] }),
  ])

  const latestActualByKey = new Map<string, ActualRow>()
  for (const row of actualRows || []) {
    const key = `${row.kpi_id}:${row.department}`
    if (!latestActualByKey.has(key)) latestActualByKey.set(key, row)
  }

  const taskStatsByKey = new Map<string, { total: number; completed: number; inProgress: number }>()
  for (const t of taskRows || []) {
    if (!t.kpi_id || !t.department) continue
    const key = `${t.kpi_id}:${t.department}`
    const stat = taskStatsByKey.get(key) || { total: 0, completed: 0, inProgress: 0 }
    stat.total += 1
    if (t.status === "completed") stat.completed += 1
    else if (t.status === "in_progress") stat.inProgress += 1
    taskStatsByKey.set(key, stat)
  }

  const data = (assignments || [])
    .filter((a) => a.corporate_kpis)
    .map((a) => {
      const kpi = a.corporate_kpis!
      const latestManual = latestActualByKey.get(`${a.kpi_id}:${a.department}`) ?? null
      const taskStat = taskStatsByKey.get(`${a.kpi_id}:${a.department}`) ?? null

      let autoDetected: {
        value: number | null
        milestones_completed?: number | null
        milestones_total?: number | null
        taskStats?: { total: number; completed: number; inProgress: number } | null
      } | null = null

      if (taskStat && taskStat.total > 0) {
        if (kpi.measure_type === "milestone") {
          autoDetected = {
            value: null,
            milestones_completed: taskStat.completed,
            milestones_total: Math.max(taskStat.total, Number(a.target_value) || 3),
            taskStats: taskStat,
          }
        } else if (kpi.measure_type === "percentage") {
          autoDetected = {
            value: Math.round((taskStat.completed / taskStat.total) * 100),
            taskStats: taskStat,
          }
        } else {
          autoDetected = {
            value: taskStat.completed,
            taskStats: taskStat,
          }
        }
      }

      const resolved = resolveEffectiveActual({
        manualActual: latestManual,
        autoDetected,
      })

      const attainment = computeAttainment({
        measureType: kpi.measure_type,
        direction: kpi.direction,
        targetValue: a.target_value,
        actualValue: resolved.effectiveActual,
        milestonesCompleted: resolved.effectiveMilestonesCompleted,
        milestonesTotal: resolved.effectiveMilestonesTotal,
      })

      return {
        assignment_id: a.id,
        kpi_id: kpi.id,
        department: a.department,
        source_sn: kpi.source_sn,
        perspective: kpi.perspective,
        strategic_priority: kpi.strategic_priority,
        strategic_objective: kpi.strategic_objective,
        measure: kpi.measure,
        target_text: kpi.target_text,
        measure_type: kpi.measure_type,
        direction: kpi.direction,
        role: a.role,
        target_value: a.target_value,
        target_unit: a.target_unit,
        department_target: a.department_target,
        proposed_action: a.proposed_action,
        latest_actual: latestManual,
        effective_actual: resolved.effectiveActual,
        effective_milestones_completed: resolved.effectiveMilestonesCompleted,
        effective_milestones_total: resolved.effectiveMilestonesTotal,
        source: resolved.source,
        is_override: resolved.isOverride,
        task_stats: resolved.taskStats ?? null,
        raw_pct: attainment.rawPct,
        capped_pct: attainment.cappedPct,
      }
    })
    .sort((a, b) => a.source_sn - b.source_sn)

  return NextResponse.json({ data, department })
}
