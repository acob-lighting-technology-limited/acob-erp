import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import {
  computeAttainment,
  ragStatus,
  rollupByPerspective,
  averageCappedPct,
  resolveEffectiveActual,
  type Direction,
  type MeasureType,
} from "@/lib/corporate-scorecard/attainment"

const log = logger("corporate-scorecard-summary")

type AssignmentRow = {
  kpi_id: string
  department: string
  role: "core" | "support"
  target_value: number | null
  corporate_kpis: {
    perspective: string
    strategic_objective: string
    measure_type: MeasureType
    direction: Direction
    target_text: string | null
  } | null
}

type ActualRow = {
  kpi_id: string
  department: string
  actual_value: number | null
  milestones_completed: number | null
  milestones_total: number | null
  recorded_at: string
}

/**
 * GET /api/corporate-scorecard/summary
 *
 * The MD view: company-wide attainment by perspective, and by department —
 * CORE ownership only, per the agreed rule that SUPPORT work does not affect
 * a department's own scorecard number.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`corporate-scorecard-summary:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const { data: assignments, error: assignmentError } = await supabase
    .from("kpi_assignments")
    .select(
      `kpi_id, department, role, target_value,
       corporate_kpis!inner ( perspective, strategic_objective, measure_type, direction, target_text )`
    )
    .eq("role", "core")
    .eq("corporate_kpis.is_archived", false)
    .returns<AssignmentRow[]>()

  if (assignmentError) {
    log.error({ err: assignmentError.message }, "Failed to load assignments for summary")
    return apiError("Failed to load the scorecard summary", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const rows = assignments || []
  if (rows.length === 0) {
    return NextResponse.json({ data: { perspectives: [], companyPct: null, departments: [] } })
  }

  const kpiIds = Array.from(new Set(rows.map((r) => r.kpi_id)))

  const [{ data: actualRows }, { data: taskRows }] = await Promise.all([
    supabase
      .from("kpi_actuals")
      .select("kpi_id, department, actual_value, milestones_completed, milestones_total, recorded_at, is_override")
      .in("kpi_id", kpiIds)
      .order("recorded_at", { ascending: false })
      .returns<ActualRow[]>(),
    supabase.from("tasks").select("id, kpi_id, department, status").in("kpi_id", kpiIds).eq("is_archived", false),
  ])

  // Most recent actual per (kpi, department) pair.
  const latestByKey = new Map<string, ActualRow>()
  for (const row of actualRows || []) {
    const key = `${row.kpi_id}:${row.department}`
    if (!latestByKey.has(key)) latestByKey.set(key, row)
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

  const perKpiRows = rows.map((row) => {
    const kpi = row.corporate_kpis!
    const latestManual = latestByKey.get(`${row.kpi_id}:${row.department}`) ?? null
    const taskStat = taskStatsByKey.get(`${row.kpi_id}:${row.department}`) ?? null

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
          milestones_total: Math.max(taskStat.total, Number(row.target_value) || 3),
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
      targetValue: row.target_value,
      targetText: kpi.target_text,
      actualValue: resolved.effectiveActual,
      milestonesCompleted: resolved.effectiveMilestonesCompleted,
      milestonesTotal: resolved.effectiveMilestonesTotal,
    })

    return {
      department: row.department,
      perspective: kpi.perspective,
      strategicObjective: kpi.strategic_objective,
      cappedPct: attainment.cappedPct,
      hasData: resolved.source !== "none",
    }
  })

  const perspectives = rollupByPerspective(
    perKpiRows.map((r) => ({
      perspective: r.perspective,
      strategicObjective: r.strategicObjective,
      cappedPct: r.cappedPct,
    }))
  )
  const companyPct = averageCappedPct(perspectives.map((p) => p.attainmentPct))

  const byDepartment = new Map<string, { attained: number[]; recordedCount: number }>()
  for (const row of perKpiRows) {
    const bucket = byDepartment.get(row.department) || { attained: [], recordedCount: 0 }
    if (row.cappedPct != null) bucket.attained.push(row.cappedPct)
    if (row.hasData) bucket.recordedCount += 1
    byDepartment.set(row.department, bucket)
  }

  const departments = Array.from(byDepartment.entries())
    .map(([department, stat]) => {
      const attainmentPct = averageCappedPct(stat.attained)
      return {
        department,
        attainmentPct,
        status: attainmentPct != null ? ragStatus(attainmentPct) : null,
        recordedKpiCount: Math.max(stat.recordedCount, stat.attained.length),
        coreKpiCount: rows.filter((r) => r.department === department).length,
      }
    })
    .sort((a, b) => (b.attainmentPct ?? -1) - (a.attainmentPct ?? -1))

  return NextResponse.json({ data: { perspectives, companyPct, departments } })
}
