import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import {
  averageCappedPct,
  resolveKpiAttainment,
  type Direction,
  type KpiTaskStats,
  type MeasureType,
} from "@/lib/corporate-scorecard/attainment"
import { computeWeightedTaskScore } from "@/lib/tasks/scoring"

const log = logger("corporate-scorecard-goals")

const QuerySchema = z.object({
  scope: z.enum(["mine", "department", "all"]).default("all"),
  department: z.string().trim().optional(),
})

type KpiRow = {
  id: string
  perspective: string
  strategic_priority: string
  strategic_objective: string
  target_text: string
  measure_type: MeasureType
  direction: Direction
}

type AssignmentRow = {
  kpi_id: string
  department: string
  role: "core" | "support"
  target_value: number | null
}

type ActualRow = {
  kpi_id: string
  department: string
  actual_value: number | null
  milestones_completed: number | null
  milestones_total: number | null
  is_override?: boolean | null
  note: string | null
}

type TaskRow = {
  id: string
  kpi_id: string | null
  department: string | null
  status: string | null
  weight: number | null
  rating: number | null
  is_archived: boolean | null
}

export type StrategicGoalRow = {
  objective: string
  perspective: string
  strategic_priority: string
  kpi_count: number
  task_total: number
  task_completed: number
  /** Weighted task score (weight x rating) on this goal's tasks — "mine" scope only. */
  task_score: number | null
  /** Average capped attainment of the goal's CORE KPIs — department/all scopes only. */
  attainment_pct: number | null
}

/**
 * GET /api/corporate-scorecard/goals?scope=mine|department|all&department=...
 *
 * Goals are the strategic objectives of the corporate scorecard. Every task is
 * tagged to a corporate KPI and every KPI belongs to one objective, so this is
 * a read-only roll-up: which goals have work against them, how much is done,
 * and how far the goal's KPIs have got. It scores nobody.
 *
 *   mine        the goals the signed-in employee's own tasks serve
 *   department  every goal the department owns or supports, including the ones
 *               with no tasks yet — those are the gaps a lead needs to see
 *   all         every goal in the company
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(`corporate-scorecard-goals:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) {
    return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

  const parsed = QuerySchema.safeParse({
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    department: request.nextUrl.searchParams.get("department") ?? undefined,
  })
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid query", ApiErrorCode.VALIDATION_ERROR, 400)
  }
  const { scope, department } = parsed.data
  if (scope === "department" && !department) {
    return apiError("A department is required", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  let assignmentQuery = supabase.from("kpi_assignments").select("kpi_id, department, role, target_value")
  let actualQuery = supabase
    .from("kpi_actuals")
    .select("kpi_id, department, actual_value, milestones_completed, milestones_total, is_override, note")
    .order("recorded_at", { ascending: false })
  let taskQuery = supabase
    .from("tasks")
    .select("id, kpi_id, department, status, weight, rating, is_archived")
    .not("kpi_id", "is", null)
    .eq("is_archived", false)

  if (scope === "department" && department) {
    assignmentQuery = assignmentQuery.eq("department", department)
    actualQuery = actualQuery.eq("department", department)
    taskQuery = taskQuery.eq("department", department)
  }
  if (scope === "mine") {
    taskQuery = taskQuery.eq("assigned_to", user.id)
  }

  const [
    { data: kpis, error: kpiError },
    { data: assignments, error: assignmentError },
    { data: actuals },
    { data: tasks, error: taskError },
  ] = await Promise.all([
    supabase
      .from("corporate_kpis")
      .select("id, perspective, strategic_priority, strategic_objective, target_text, measure_type, direction")
      .eq("is_archived", false)
      .order("source_sn")
      .returns<KpiRow[]>(),
    scope === "mine"
      ? Promise.resolve({ data: [] as AssignmentRow[], error: null })
      : assignmentQuery.returns<AssignmentRow[]>(),
    scope === "mine" ? Promise.resolve({ data: [] as ActualRow[] }) : actualQuery.returns<ActualRow[]>(),
    taskQuery.returns<TaskRow[]>(),
  ])

  if (kpiError || assignmentError || taskError) {
    log.error(
      { err: kpiError?.message || assignmentError?.message || taskError?.message, scope, department },
      "Failed to load strategic goals"
    )
    return apiError("Failed to load goals", ApiErrorCode.DATABASE_ERROR, 500)
  }

  const kpiById = new Map((kpis || []).map((kpi) => [kpi.id, kpi]))

  const latestActualByKey = new Map<string, ActualRow>()
  for (const row of actuals || []) {
    const key = `${row.kpi_id}:${row.department}`
    if (!latestActualByKey.has(key)) latestActualByKey.set(key, row)
  }

  const taskStatsByKey = new Map<string, KpiTaskStats>()
  for (const task of tasks || []) {
    if (!task.kpi_id || !task.department) continue
    const key = `${task.kpi_id}:${task.department}`
    const stat = taskStatsByKey.get(key) || { total: 0, completed: 0, inProgress: 0 }
    stat.total += 1
    if (task.status === "completed") stat.completed += 1
    else if (task.status === "in_progress") stat.inProgress += 1
    taskStatsByKey.set(key, stat)
  }

  type Bucket = {
    perspective: string
    strategic_priority: string
    kpiIds: Set<string>
    tasks: TaskRow[]
    coreAttainments: Array<number | null>
  }
  const byObjective = new Map<string, Bucket>()
  const bucketFor = (kpi: KpiRow) => {
    let bucket = byObjective.get(kpi.strategic_objective)
    if (!bucket) {
      bucket = {
        perspective: kpi.perspective,
        strategic_priority: kpi.strategic_priority,
        kpiIds: new Set(),
        tasks: [],
        coreAttainments: [],
      }
      byObjective.set(kpi.strategic_objective, bucket)
    }
    return bucket
  }

  // Which goals appear: every goal for "all", the goals the department is
  // assigned to for "department" (zero-task ones included, deliberately), and
  // only the goals the employee's own tasks serve for "mine".
  if (scope === "all") {
    for (const kpi of kpis || []) bucketFor(kpi).kpiIds.add(kpi.id)
  }

  for (const assignment of assignments || []) {
    const kpi = kpiById.get(assignment.kpi_id)
    if (!kpi) continue
    const bucket = bucketFor(kpi)
    bucket.kpiIds.add(kpi.id)
    if (assignment.role !== "core") continue
    const { attainment } = resolveKpiAttainment({
      measureType: kpi.measure_type,
      direction: kpi.direction,
      targetValue: assignment.target_value,
      targetText: kpi.target_text,
      manualActual: latestActualByKey.get(`${kpi.id}:${assignment.department}`) ?? null,
      taskStats: taskStatsByKey.get(`${kpi.id}:${assignment.department}`) ?? null,
    })
    bucket.coreAttainments.push(attainment.cappedPct)
  }

  for (const task of tasks || []) {
    const kpi = task.kpi_id ? kpiById.get(task.kpi_id) : undefined
    if (!kpi) continue
    // A department task tagged to a KPI the department is not assigned to still
    // shows up — under its goal — rather than vanishing from the count.
    const bucket = bucketFor(kpi)
    bucket.kpiIds.add(kpi.id)
    bucket.tasks.push(task)
  }

  const data: StrategicGoalRow[] = Array.from(byObjective.entries())
    .map(([objective, bucket]) => ({
      objective,
      perspective: bucket.perspective,
      strategic_priority: bucket.strategic_priority,
      kpi_count: bucket.kpiIds.size,
      task_total: bucket.tasks.length,
      task_completed: bucket.tasks.filter((task) => task.status === "completed").length,
      task_score: scope === "mine" ? computeWeightedTaskScore(bucket.tasks).score : null,
      attainment_pct: scope === "mine" ? null : averageCappedPct(bucket.coreAttainments),
    }))
    .sort((a, b) => a.perspective.localeCompare(b.perspective) || a.objective.localeCompare(b.objective))

  return NextResponse.json({ data })
}
