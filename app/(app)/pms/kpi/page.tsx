import { createClient } from "@/lib/supabase/server"
import { getCurrentUserPmsData } from "../_lib"
import { TASK_WEIGHT_DEFAULT, isTaskInCycle } from "@/lib/tasks/scoring"
import { EmployeeKpiTabs } from "./_components/employee-kpi-tabs"

type GoalCycleRow = {
  id: string
  review_cycle_id: string | null
}

type ReviewCycleRow = {
  id: string
  name: string
}

type GoalTaskRow = {
  id: string
  goal_id: string | null
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
  const { score, cycles, activeCycleId, goalSummary, profile } = await getCurrentUserPmsData(cycle_id)
  const supabase = await createClient()

  const goalIds = score.breakdown.goals.map((goal) => goal.goal_id).filter((id): id is string => Boolean(id))
  // Tasks with no goal are scored work too — they are grouped under the empty
  // key, which is exactly the id filtered out of `goalIds` above.
  const hasAdHocGroup = score.breakdown.goals.some((goal) => !goal.goal_id)

  const TASK_FIELDS =
    "id, goal_id, title, description, status, due_date, task_end_date, created_at, weight, rating, assignment_type, assigned_to, department"

  let goalCycleByGoalId = new Map<string, string>()
  const tasksByGoalId = new Map<string, KpiTableTask[]>()

  if (goalIds.length > 0 || hasAdHocGroup) {
    const [
      { data: goalCycleRows },
      { data: cycleRows },
      { data: taskRows },
      { data: adHocRows },
      { data: completionRows },
    ] = await Promise.all([
      goalIds.length > 0
        ? supabase.from("goals_objectives").select("id, review_cycle_id").in("id", goalIds).returns<GoalCycleRow[]>()
        : Promise.resolve({ data: [] as GoalCycleRow[] }),
      supabase
        .from("review_cycles")
        .select("id, name, start_date")
        .returns<Array<ReviewCycleRow & { start_date: string | null }>>(),
      goalIds.length > 0
        ? supabase.from("tasks").select(TASK_FIELDS).in("goal_id", goalIds).returns<GoalTaskRow[]>()
        : Promise.resolve({ data: [] as GoalTaskRow[] }),
      hasAdHocGroup && profile?.id
        ? supabase
            .from("tasks")
            .select(TASK_FIELDS)
            .is("goal_id", null)
            .eq("assigned_to", profile.id)
            .eq("is_archived", false)
            .returns<GoalTaskRow[]>()
        : Promise.resolve({ data: [] as GoalTaskRow[] }),
      profile?.id
        ? supabase
            .from("task_user_completion")
            .select("task_id")
            .eq("user_id", profile.id)
            .returns<TaskCompletionRow[]>()
        : Promise.resolve({ data: [] as TaskCompletionRow[] }),
    ])

    const cycleNameById = new Map<string, string>()
    for (const cycle of cycleRows || []) {
      cycleNameById.set(cycle.id, cycle.name || toQuarterLabel(cycle.start_date))
    }

    goalCycleByGoalId = new Map(
      (goalCycleRows || []).map((goalCycle) => [
        goalCycle.id,
        goalCycle.review_cycle_id ? cycleNameById.get(goalCycle.review_cycle_id) || "Current" : "Current",
      ])
    )

    const completedTaskIds = new Set((completionRows || []).map((row) => row.task_id))
    const currentUserId = profile?.id || ""
    const currentUserDepartment = profile?.department || ""

    const cycleStart = score.cycle_start_date
    const cycleEnd = score.cycle_end_date

    for (const task of [...(taskRows || []), ...(adHocRows || [])]) {
      // The score counts a task in the cycle its deadline falls in, so the
      // drill-down has to use the same rule or it lists work the number above
      // it never included.
      if (cycleStart && cycleEnd && !isTaskInCycle(task, cycleStart, cycleEnd)) continue

      const assignmentType = String(task.assignment_type || "")
      const isIndividualTaskForUser = assignmentType === "individual" && task.assigned_to === currentUserId
      const isDepartmentTaskForUser =
        assignmentType === "department" && Boolean(currentUserDepartment) && task.department === currentUserDepartment
      const hasCompletionByUser = completedTaskIds.has(task.id)

      if (!isIndividualTaskForUser && !isDepartmentTaskForUser && !hasCompletionByUser) {
        continue
      }

      const groupKey = task.goal_id || ""
      const existing = tasksByGoalId.get(groupKey) || []
      existing.push({
        id: task.id,
        title: task.title || "Untitled task",
        description: task.description,
        status: task.status || "pending",
        dueDate: task.task_end_date || task.due_date,
        assignmentType: assignmentType || "department",
        weight: task.weight ?? TASK_WEIGHT_DEFAULT,
        rating: task.rating,
      })
      tasksByGoalId.set(groupKey, existing)
    }
  }

  const rows: KpiTableRow[] = score.breakdown.goals.map((goal) => {
    const goalTasks = tasksByGoalId.get(goal.goal_id) || []
    const ratedTasks = goalTasks.filter((t) => typeof t.rating === "number" && t.rating > 0)
    const avgRating =
      ratedTasks.length > 0
        ? (ratedTasks.reduce((acc, t) => acc + (t.rating || 0), 0) / ratedTasks.length).toFixed(1)
        : null

    const earnedPoints = goalTasks.reduce((acc, t) => {
      if (!t.weight || t.rating == null) return acc
      return acc + (t.weight * t.rating) / 5
    }, 0)
    const roundedEarned = Math.round(earnedPoints * 100) / 100

    return {
      cycle: goalCycleByGoalId.get(goal.goal_id) || "Current",
      rating: avgRating ? `${avgRating}/5` : "Unrated",
      earned: `${roundedEarned} / ${goal.priority_weight}`,
      effective_kpi_pct: `${goal.effective_kpi_pct}%`,
      linked_tasks: `${goal.linked_tasks_completed}/${goal.linked_tasks_total}`,
      weight: String(goal.priority_weight),
      __goalId: goal.goal_id,
      __tasks: goalTasks,
    }
  })

  return (
    <EmployeeKpiTabs
      department={profile?.department || null}
      initialTab={tab}
      cycles={cycles}
      activeCycleId={activeCycleId}
      kpiScore={score.kpi_score}
      approvedGoals={goalSummary.approved}
      completedGoals={goalSummary.completed}
      cycleName={score.cycle_name || "Active Cycle"}
      rows={rows}
    />
  )
}
