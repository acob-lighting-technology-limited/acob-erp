import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import {
  computeAttainment,
  computePacingStatus,
  averageCappedPct,
  ragStatus,
  type MeasureType,
  type Direction,
} from "@/lib/corporate-scorecard/attainment"

const log = logger("corporate-scorecard-register")

type KpiRow = {
  id: string
  source_sn: number
  perspective: string
  strategic_priority: string
  strategic_objective: string
  measure: string
  target_text: string
  measure_type: MeasureType
  direction: Direction
}

type AssignmentRow = {
  id: string
  kpi_id: string
  department: string
  role: "core" | "support"
  target_value: number | null
  target_unit: string | null
  department_target: string | null
  proposed_action: string | null
}

type ActualRow = {
  kpi_id: string
  department: string
  actual_value: number | null
  milestones_completed: number | null
  milestones_total: number | null
  note: string | null
  recorded_at: string
}

type TaskCountRow = {
  kpi_id: string
  status: string
}

/**
 * GET /api/corporate-scorecard/register
 *
 * The master register returning corporate KPIs with detailed RACI ownership,
 * department targets, latest recorded actuals, attainment percentages,
 * 2026 pacing status, and linked task counts.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`corporate-scorecard-register:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const [
    { data: kpis, error: kpiError },
    { data: assignments, error: assignmentError },
    { data: actuals, error: actualError },
    { data: taskRows, error: taskError },
  ] = await Promise.all([
    supabase
      .from("corporate_kpis")
      .select(
        "id, source_sn, perspective, strategic_priority, strategic_objective, measure, target_text, measure_type, direction"
      )
      .eq("is_archived", false)
      .order("source_sn")
      .returns<KpiRow[]>(),
    supabase
      .from("kpi_assignments")
      .select("id, kpi_id, department, role, target_value, target_unit, department_target, proposed_action")
      .returns<AssignmentRow[]>(),
    supabase
      .from("kpi_actuals")
      .select("kpi_id, department, actual_value, milestones_completed, milestones_total, note, recorded_at")
      .order("recorded_at", { ascending: false })
      .returns<ActualRow[]>(),
    supabase
      .from("tasks")
      .select("kpi_id, status")
      .not("kpi_id", "is", null)
      .eq("is_archived", false)
      .returns<TaskCountRow[]>(),
  ])

  if (kpiError || assignmentError) {
    log.error({ err: kpiError?.message || assignmentError?.message }, "Failed to load corporate scorecard register")
    return apiError("Failed to load the corporate scorecard", ApiErrorCode.DATABASE_ERROR, 500)
  }

  if (actualError) {
    log.warn({ err: actualError.message }, "Non-fatal error loading kpi_actuals for register")
  }
  if (taskError) {
    log.warn({ err: taskError.message }, "Non-fatal error loading tasks for register")
  }

  // Pre-index the latest actual per (kpi_id, department)
  const latestActualMap = new Map<string, ActualRow>()
  for (const row of actuals || []) {
    const key = `${row.kpi_id}:${row.department}`
    if (!latestActualMap.has(key)) {
      latestActualMap.set(key, row)
    }
  }

  // Pre-index task counts by kpi_id
  const taskCountsByKpi = new Map<string, { total: number; completed: number; in_progress: number }>()
  for (const task of taskRows || []) {
    if (!task.kpi_id) continue
    const counts = taskCountsByKpi.get(task.kpi_id) || { total: 0, completed: 0, in_progress: 0 }
    counts.total += 1
    if (task.status === "completed") {
      counts.completed += 1
    } else if (task.status === "in_progress" || task.status === "pending") {
      counts.in_progress += 1
    }
    taskCountsByKpi.set(task.kpi_id, counts)
  }

  // Group assignments by kpi_id
  const assignmentsByKpi = new Map<string, AssignmentRow[]>()
  for (const row of assignments || []) {
    const bucket = assignmentsByKpi.get(row.kpi_id) || []
    bucket.push(row)
    assignmentsByKpi.set(row.kpi_id, bucket)
  }

  const data = (kpis || []).map((kpi) => {
    const rows = assignmentsByKpi.get(kpi.id) || []

    const detailedAssignments = rows.map((a) => {
      const latest = latestActualMap.get(`${kpi.id}:${a.department}`) || null
      const attainment = computeAttainment({
        measureType: kpi.measure_type,
        direction: kpi.direction,
        targetValue: a.target_value,
        actualValue: latest?.actual_value ?? null,
        milestonesCompleted: latest?.milestones_completed ?? null,
        milestonesTotal: latest?.milestones_total ?? null,
      })

      return {
        id: a.id,
        department: a.department,
        role: a.role,
        target_value: a.target_value,
        target_unit: a.target_unit,
        department_target: a.department_target,
        proposed_action: a.proposed_action,
        latest_actual: latest
          ? {
              actual_value: latest.actual_value,
              milestones_completed: latest.milestones_completed,
              milestones_total: latest.milestones_total,
              note: latest.note,
              recorded_at: latest.recorded_at,
            }
          : null,
        raw_pct: attainment.rawPct,
        capped_pct: attainment.cappedPct,
        status: attainment.cappedPct != null ? ragStatus(attainment.cappedPct) : null,
      }
    })

    const coreAttainments = detailedAssignments
      .filter((a) => a.role === "core" && a.capped_pct != null)
      .map((a) => a.capped_pct)
    const overallAttainment = averageCappedPct(coreAttainments)
    const pacing = computePacingStatus(overallAttainment)
    const taskStats = taskCountsByKpi.get(kpi.id) || { total: 0, completed: 0, in_progress: 0 }

    return {
      ...kpi,
      core_departments: rows.filter((r) => r.role === "core").map((r) => r.department),
      support_departments: rows.filter((r) => r.role === "support").map((r) => r.department),
      assignments: detailedAssignments,
      overall_attainment: overallAttainment,
      overall_status: overallAttainment != null ? ragStatus(overallAttainment) : null,
      pacing,
      task_stats: taskStats,
    }
  })

  return NextResponse.json({ data })
}
