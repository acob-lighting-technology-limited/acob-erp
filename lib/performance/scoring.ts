import type { SupabaseClient } from "@supabase/supabase-js"

type GoalScoreBreakdown = {
  goal_id: string
  title: string
  linked_tasks_total: number
  linked_tasks_completed: number
  goal_progress_pct: number
  effective_kpi_pct: number
}

type AttendanceBreakdown = {
  present: number
  total: number
  score: number
}

type DepartmentMetricBreakdown = {
  average_individual_kpi: number
  action_item_score: number
  help_desk_score: number
  task_project_delivery_score: number
  learning_capability_score: number
  attendance_compliance_score: number
  behaviour_leadership_score: number
}

type ReviewCycleRow = {
  id: string
  start_date: string
  end_date: string
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100
}

async function getCycleWindow(supabase: SupabaseClient, cycleId?: string | null): Promise<ReviewCycleRow | null> {
  if (!cycleId) return null
  const { data } = await supabase
    .from("review_cycles")
    .select("id, start_date, end_date")
    .eq("id", cycleId)
    .maybeSingle<ReviewCycleRow>()
  return data ?? null
}

export async function computeIndividualPerformanceScore(
  supabase: SupabaseClient,
  params: { userId: string; cycleId?: string | null }
) {
  const cycle = await getCycleWindow(supabase, params.cycleId)

  let goalQuery = supabase
    .from("goals_objectives")
    .select("id, title, target_value, achieved_value")
    .eq("user_id", params.userId)
    .eq("approval_status", "approved")

  if (params.cycleId) {
    goalQuery = goalQuery.eq("review_cycle_id", params.cycleId)
  }

  const { data: goals } = await goalQuery

  let kpiScore = 0
  const goalBreakdown: GoalScoreBreakdown[] = []

  if (goals && goals.length > 0) {
    let totalPct = 0
    for (const goal of goals) {
      const { data: taskSummary } = await supabase.from("tasks").select("status").eq("goal_id", goal.id)
      const totalTasks = taskSummary?.length || 0
      const completedTasks = (taskSummary || []).filter((task) => task.status === "completed").length

      const targetValue = typeof goal.target_value === "number" ? goal.target_value : Number(goal.target_value || 0)
      const achievedValue =
        typeof goal.achieved_value === "number" ? goal.achieved_value : Number(goal.achieved_value || 0)
      const goalProgressPct = targetValue > 0 ? Math.min((achievedValue / targetValue) * 100, 100) : 0
      const effectivePct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : goalProgressPct

      goalBreakdown.push({
        goal_id: goal.id,
        title: goal.title,
        linked_tasks_total: totalTasks,
        linked_tasks_completed: completedTasks,
        goal_progress_pct: roundScore(goalProgressPct),
        effective_kpi_pct: roundScore(effectivePct),
      })

      totalPct += effectivePct
    }

    kpiScore = roundScore(totalPct / goals.length)
  }

  let attendanceScore = 0
  const attendanceBreakdown: AttendanceBreakdown = {
    present: 0,
    total: 0,
    score: 0,
  }

  if (cycle) {
    const { data: attendance } = await supabase
      .from("attendance_records")
      .select("status")
      .eq("user_id", params.userId)
      .gte("date", cycle.start_date)
      .lte("date", cycle.end_date)

    if (attendance && attendance.length > 0) {
      const present = attendance.filter((row) =>
        ["present", "late", "wfh", "remote"].includes(String(row.status || "").toLowerCase())
      ).length
      attendanceBreakdown.present = present
      attendanceBreakdown.total = attendance.length
      attendanceScore = roundScore((present / attendance.length) * 100)
      attendanceBreakdown.score = attendanceScore
    }
  }

  let cbtScore = 0
  const { data: kssResults } = await supabase.from("kss_results").select("score").eq("presenter_id", params.userId)
  if (kssResults && kssResults.length > 0) {
    cbtScore = roundScore(kssResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / kssResults.length)
  }

  let behaviourScore = 0
  let reviewQuery = supabase
    .from("performance_reviews")
    .select("behaviour_score")
    .eq("user_id", params.userId)
    .not("behaviour_score", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (params.cycleId) {
    reviewQuery = reviewQuery.eq("review_cycle_id", params.cycleId)
  }

  const { data: behaviourRows } = await reviewQuery
  if (behaviourRows && behaviourRows.length > 0) {
    behaviourScore = roundScore(Number(behaviourRows[0]?.behaviour_score) || 0)
  }

  const finalScore = roundScore(kpiScore * 0.7 + cbtScore * 0.1 + attendanceScore * 0.1 + behaviourScore * 0.1)

  return {
    user_id: params.userId,
    cycle_id: params.cycleId ?? null,
    kpi_score: kpiScore,
    cbt_score: cbtScore,
    attendance_score: attendanceScore,
    behaviour_score: behaviourScore,
    final_score: finalScore,
    breakdown: {
      goals: goalBreakdown,
      attendance: attendanceBreakdown,
    },
  }
}

export async function computeDepartmentPerformanceScore(
  supabase: SupabaseClient,
  params: { department: string; cycleId?: string | null }
) {
  const cycle = await getCycleWindow(supabase, params.cycleId)
  const employeeQuery = supabase
    .from("profiles")
    .select("id")
    .eq("department", params.department)
    .eq("employment_status", "active")

  const { data: employees } = await employeeQuery
  const employeeIds = (employees || []).map((row) => row.id)

  const individualScores =
    employeeIds.length > 0
      ? await Promise.all(
          employeeIds.map((userId) => computeIndividualPerformanceScore(supabase, { userId, cycleId: params.cycleId }))
        )
      : []

  const averageIndividualKpi =
    individualScores.length > 0
      ? roundScore(individualScores.reduce((sum, score) => sum + score.kpi_score, 0) / individualScores.length)
      : 0

  const averageLearningCapability =
    individualScores.length > 0
      ? roundScore(individualScores.reduce((sum, score) => sum + score.cbt_score, 0) / individualScores.length)
      : 0

  const averageAttendanceCompliance =
    individualScores.length > 0
      ? roundScore(individualScores.reduce((sum, score) => sum + score.attendance_score, 0) / individualScores.length)
      : 0

  let actionItemsQuery = supabase.from("action_items").select("status").eq("department", params.department)
  let helpDeskQuery = supabase.from("help_desk_tickets").select("status").eq("service_department", params.department)
  let taskDeliveryQuery = supabase
    .from("tasks")
    .select("status, source_type")
    .eq("department", params.department)
    .neq("source_type", "help_desk")

  if (cycle) {
    actionItemsQuery = actionItemsQuery.gte("created_at", cycle.start_date).lte("created_at", cycle.end_date)
    helpDeskQuery = helpDeskQuery.gte("created_at", cycle.start_date).lte("created_at", cycle.end_date)
    taskDeliveryQuery = taskDeliveryQuery.gte("created_at", cycle.start_date).lte("created_at", cycle.end_date)
  }

  const [{ data: actionItems }, { data: helpDeskTickets }, { data: departmentTasks }] = await Promise.all([
    actionItemsQuery,
    helpDeskQuery,
    taskDeliveryQuery,
  ])

  const actionItemScore =
    actionItems && actionItems.length > 0
      ? roundScore((actionItems.filter((item) => item.status === "completed").length / actionItems.length) * 100)
      : 0

  const helpDeskScore =
    helpDeskTickets && helpDeskTickets.length > 0
      ? roundScore(
          (helpDeskTickets.filter((ticket) =>
            ["resolved", "closed"].includes(String(ticket.status || "").toLowerCase())
          ).length /
            helpDeskTickets.length) *
            100
        )
      : 0

  const taskProjectDeliveryScore =
    departmentTasks && departmentTasks.length > 0
      ? roundScore(
          (departmentTasks.filter((task) => task.status === "completed").length / departmentTasks.length) * 100
        )
      : 0

  let behaviourLeadershipScore = 0
  if (employeeIds.length > 0) {
    let reviewQuery = supabase
      .from("performance_reviews")
      .select("behaviour_score")
      .in("user_id", employeeIds)
      .not("behaviour_score", "is", null)
    if (params.cycleId) {
      reviewQuery = reviewQuery.eq("review_cycle_id", params.cycleId)
    }
    const { data: behaviourReviews } = await reviewQuery
    if (behaviourReviews && behaviourReviews.length > 0) {
      behaviourLeadershipScore = roundScore(
        behaviourReviews.reduce((sum, row) => sum + (Number(row.behaviour_score) || 0), 0) / behaviourReviews.length
      )
    }
  }

  const departmentKpi = roundScore(
    averageIndividualKpi * 0.4 + actionItemScore * 0.2 + helpDeskScore * 0.2 + taskProjectDeliveryScore * 0.2
  )

  const departmentPms = roundScore(
    departmentKpi * 0.7 +
      averageLearningCapability * 0.1 +
      averageAttendanceCompliance * 0.1 +
      behaviourLeadershipScore * 0.1
  )

  const breakdown: DepartmentMetricBreakdown = {
    average_individual_kpi: averageIndividualKpi,
    action_item_score: actionItemScore,
    help_desk_score: helpDeskScore,
    task_project_delivery_score: taskProjectDeliveryScore,
    learning_capability_score: averageLearningCapability,
    attendance_compliance_score: averageAttendanceCompliance,
    behaviour_leadership_score: behaviourLeadershipScore,
  }

  return {
    department: params.department,
    cycle_id: params.cycleId ?? null,
    department_kpi: departmentKpi,
    department_pms: departmentPms,
    breakdown,
    employee_count: employeeIds.length,
  }
}
