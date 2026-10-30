import { createClient } from "@/lib/supabase/server"
import { getCurrentUserPmsData } from "../_lib"
import { TASK_WEIGHT_DEFAULT, computeWeightedTaskScore, isTaskInCycle } from "@/lib/tasks/scoring"
import { formatCycleLabel, matchesCadence } from "@/lib/pms/cadence"
import type { Metadata } from "next"
import { EmployeeKpiTabs } from "./_components/employee-kpi-tabs"

export const metadata: Metadata = { title: "PMS KPI" }

type TaskRow = {
  id: string
  goal_id: string | null
  kpi_id: string | null
  title: string | null
  description: string | null
  status: string | null
  due_date: string | null
  task_end_date: string | null
  created_at: string | null
  weight: number | null
  rating: number | null
  assignment_type: string | null
  assigned_to: string | null
  department: string | null
  series_id: string | null
}

type TaskCompletionRow = {
  task_id: string
}

type KpiTableTask = {
  id: string
  title: string
  description: string | null
  status: string
  dueDate: string | null
  assignmentType: string
  weight: number
  rating: number | null
  kpiTitle?: string | null
  series_id?: string | null
}

type KpiTableRow = {
  cycle: string
  rating: string
  earned: string
  effective_kpi_pct: string
  linked_tasks: string
  weight: string
  __goalId: string
  __tasks: KpiTableTask[]
}

function toQuarterLabel(dateString?: string | null) {
  if (!dateString) return "Current"
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return "Current"
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `Q${quarter} ${date.getFullYear()}`
}

export default async function PmsKpiPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle_id?: string; tab?: string }>
}) {
  const { cycle_id, tab } = await searchParams
  const effectiveCycleId = cycle_id ?? "all"
  const { score, cycles, activeCycleId, profile } = await getCurrentUserPmsData(effectiveCycleId)
  const supabase = await createClient()

  const quarterlyCycles = cycles
    .filter((c) => matchesCadence("quarterly", c.reviewType, c.name))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

  const targetCycles =
    effectiveCycleId && effectiveCycleId !== "all"
      ? quarterlyCycles.filter((c) => c.id === effectiveCycleId)
      : quarterlyCycles

  const TASK_FIELDS =
    "id, goal_id, kpi_id, title, description, status, due_date, task_end_date, created_at, weight, rating, assignment_type, assigned_to, department, series_id"

  const currentUserId = profile?.id || ""

  const [{ data: assignedTasks }, { data: completionRows }] = await Promise.all([
    currentUserId
      ? supabase
          .from("tasks")
          .select(TASK_FIELDS)
          .eq("assigned_to", currentUserId)
          .eq("is_archived", false)
          .returns<TaskRow[]>()
      : Promise.resolve({ data: [] as TaskRow[] }),
    currentUserId
      ? supabase
          .from("task_user_completion")
          .select("task_id")
          .eq("user_id", currentUserId)
          .returns<TaskCompletionRow[]>()
      : Promise.resolve({ data: [] as TaskCompletionRow[] }),
  ])

  const completedTaskIds = new Set((completionRows || []).map((row) => row.task_id))

  const { data: completedExtraTasks } =
    completedTaskIds.size > 0
      ? await supabase
          .from("tasks")
          .select(TASK_FIELDS)
          .in("id", Array.from(completedTaskIds))
          .eq("is_archived", false)
          .returns<TaskRow[]>()
      : { data: [] as TaskRow[] }

  const taskMap = new Map<string, TaskRow>()
  for (const t of [...(assignedTasks || []), ...(completedExtraTasks || [])]) {
    if (t?.id) taskMap.set(t.id, t)
  }
  const allUserTasks = Array.from(taskMap.values())

  const kpiIds = Array.from(new Set(allUserTasks.map((t) => t.kpi_id).filter(Boolean))) as string[]
  const { data: kpiRows } =
    kpiIds.length > 0
      ? await supabase
          .from("corporate_kpis")
          .select("id, measure, strategic_objective")
          .in("id", kpiIds)
          .returns<Array<{ id: string; measure: string; strategic_objective: string }>>()
      : { data: [] }
  const kpiTitleById = new Map((kpiRows || []).map((k) => [k.id, k.measure || k.strategic_objective]))

  const matchedTaskIds = new Set<string>()

  const rows: KpiTableRow[] = targetCycles.map((cycle) => {
    const matchingTasks = allUserTasks.filter((task) => {
      const match = isTaskInCycle(task, cycle.startDate, cycle.endDate)
      if (match) matchedTaskIds.add(task.id)
      return match
    })

    const cycleTasks: KpiTableTask[] = matchingTasks.map((task) => ({
      id: task.id,
      title: task.title || "Untitled task",
      description: task.description,
      status: task.status || "pending",
      dueDate: task.task_end_date || task.due_date,
      assignmentType: task.assignment_type || "individual",
      weight: task.weight ?? TASK_WEIGHT_DEFAULT,
      rating: task.rating,
      kpiTitle: task.kpi_id ? kpiTitleById.get(task.kpi_id) || null : null,
      series_id: task.series_id,
    }))

    const taskScore = computeWeightedTaskScore(cycleTasks)
    const ratedTasks = cycleTasks.filter((t) => typeof t.rating === "number" && t.rating > 0)
    const avgRating =
      ratedTasks.length > 0
        ? (ratedTasks.reduce((acc, t) => acc + (t.rating || 0), 0) / ratedTasks.length).toFixed(1)
        : null

    const effectiveKpi = taskScore.score !== null ? `${Math.round(taskScore.score)}%` : "-"
    const roundedEarned = Math.round(taskScore.earnedPoints * 100) / 100
    // A recurring series is one item worth its weight once (lib/tasks/scoring.ts).
    const scoredWeight = Math.round(taskScore.availablePoints * 100) / 100
    const totalWeight = cycleTasks.reduce((acc, t) => acc + (t.weight || 0), 0)

    let completionLabel = `${ratedTasks.length}/${cycleTasks.length}`
    if (taskScore.awaitingRatingCount > 0) {
      completionLabel += ` (${taskScore.awaitingRatingCount} awaiting rating)`
    } else if (taskScore.unresolvedCount > 0) {
      completionLabel += ` (${taskScore.unresolvedCount} in progress)`
    }

    return {
      cycle: formatCycleLabel(cycle.name),
      rating: avgRating ? `${avgRating}/5` : "Unrated",
      earned: `${roundedEarned} / ${scoredWeight}`,
      effective_kpi_pct: effectiveKpi,
      linked_tasks: completionLabel,
      weight: String(totalWeight),
      __goalId: cycle.id,
      __tasks: cycleTasks,
    }
  })

  // Catch any tasks not covered by known quarterly cycles
  const unmatchedTasks = allUserTasks.filter((t) => !matchedTaskIds.has(t.id))
  if (unmatchedTasks.length > 0 && effectiveCycleId === "all") {
    const taskScore = computeWeightedTaskScore(unmatchedTasks)
    const unratedTasks = unmatchedTasks.filter((t) => typeof t.rating === "number" && t.rating > 0)
    const avgRating =
      unratedTasks.length > 0
        ? (unratedTasks.reduce((acc, t) => acc + (t.rating || 0), 0) / unratedTasks.length).toFixed(1)
        : null

    const effectiveKpi = taskScore.score !== null ? `${Math.round(taskScore.score)}%` : "-"
    const roundedEarned = Math.round(taskScore.earnedPoints * 100) / 100
    const scoredWeight = Math.round(taskScore.availablePoints * 100) / 100
    const totalWeight = unmatchedTasks.reduce((acc, t) => acc + (t.weight || 0), 0)

    let completionLabel = `${unratedTasks.length}/${unmatchedTasks.length}`
    if (taskScore.awaitingRatingCount > 0) {
      completionLabel += ` (${taskScore.awaitingRatingCount} awaiting rating)`
    } else if (taskScore.unresolvedCount > 0) {
      completionLabel += ` (${taskScore.unresolvedCount} in progress)`
    }

    rows.push({
      cycle: "Ad-hoc / Undated",
      rating: avgRating ? `${avgRating}/5` : "Unrated",
      earned: `${roundedEarned} / ${scoredWeight}`,
      effective_kpi_pct: effectiveKpi,
      linked_tasks: completionLabel,
      weight: String(totalWeight),
      __goalId: "adhoc",
      __tasks: unmatchedTasks.map((t) => ({
        id: t.id,
        title: t.title || "Untitled task",
        description: t.description,
        status: t.status || "pending",
        dueDate: t.task_end_date || t.due_date,
        assignmentType: t.assignment_type || "individual",
        weight: t.weight ?? TASK_WEIGHT_DEFAULT,
        rating: t.rating,
        kpiTitle: t.kpi_id ? kpiTitleById.get(t.kpi_id) || null : null,
      })),
    })
  }

  return (
    <EmployeeKpiTabs
      department={profile?.department || null}
      initialTab={tab}
      cycles={cycles}
      activeCycleId={activeCycleId}
      kpiScore={score.kpi_score}
      cycleName={score.cycle_name || (effectiveCycleId === "all" ? "All Quarters" : "Active Cycle")}
      rows={rows}
    />
  )
}
