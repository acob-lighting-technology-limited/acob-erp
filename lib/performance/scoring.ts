import type { SupabaseClient } from "@supabase/supabase-js"

type GoalScoreBreakdown = {
  goal_id: string
  title: string
  priority: string
  priority_weight: number
  custom_weight_pct: number | null
  linked_tasks_total: number
  linked_tasks_completed: number
  goal_progress_pct: number
  effective_kpi_pct: number
  is_system_generated: boolean
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

const PRIORITY_WEIGHTS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

function getPriorityWeight(priority: string | null | undefined): number {
  return PRIORITY_WEIGHTS[String(priority || "medium").toLowerCase()] ?? 2
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
    .select("id, title, target_value, achieved_value, priority, is_system_generated, weight_pct")
    .eq("user_id", params.userId)
    .eq("approval_status", "approved")

  if (params.cycleId) {
    goalQuery = goalQuery.eq("review_cycle_id", params.cycleId)
  }

  const { data: goals } = await goalQuery

  // ── Fix 1: Include department-assigned tasks this user individually completed ──
  // Query task_user_completion to find tasks where this user recorded completion,
  // even if the task was assigned to the whole department (not directly to them).
  const { data: userCompletions } = await supabase
    .from("task_user_completion")
    .select("task_id")
    .eq("user_id", params.userId)
  const userCompletedTaskIds = new Set((userCompletions || []).map((row) => row.task_id))

  let kpiScore = 0
  const goalBreakdown: GoalScoreBreakdown[] = []

  if (goals && goals.length > 0) {
    let weightedPctSum = 0
    let totalWeight = 0

    for (const goal of goals) {
      const { data: taskSummary } = await supabase.from("tasks").select("id, status").eq("goal_id", goal.id)
      const totalTasks = taskSummary?.length || 0
      // Count a task as completed if its status is "completed" OR if this user
      // individually completed it (via task_user_completion for dept-assigned tasks).
      const completedTasks = (taskSummary || []).filter(
        (task) => task.status === "completed" || userCompletedTaskIds.has(task.id)
      ).length

      const targetValue = typeof goal.target_value === "number" ? goal.target_value : Number(goal.target_value || 0)
      const achievedValue =
        typeof goal.achieved_value === "number" ? goal.achieved_value : Number(goal.achieved_value || 0)
      const goalProgressPct = targetValue > 0 ? Math.min((achievedValue / targetValue) * 100, 100) : 0
      const effectivePct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : goalProgressPct

      // ── Fix 5: Custom goal weights ──
      // If weight_pct is set (e.g. 30 = 30%), use it directly.
      // Otherwise fall back to priority-based weighting.
      const customWeightPct = typeof goal.weight_pct === "number" ? goal.weight_pct : null
      const weight = customWeightPct !== null ? customWeightPct : getPriorityWeight(goal.priority)
      const isSystemGenerated = goal.is_system_generated === true
      const usingCustomWeights = customWeightPct !== null

      goalBreakdown.push({
        goal_id: goal.id,
        title: goal.title,
        priority: String(goal.priority || "medium"),
        priority_weight: usingCustomWeights ? weight : getPriorityWeight(goal.priority),
        custom_weight_pct: customWeightPct,
        linked_tasks_total: totalTasks,
        linked_tasks_completed: completedTasks,
        goal_progress_pct: roundScore(goalProgressPct),
        effective_kpi_pct: roundScore(effectivePct),
        is_system_generated: isSystemGenerated,
      })

      weightedPctSum += effectivePct * weight
      totalWeight += weight
    }

    kpiScore = totalWeight > 0 ? roundScore(weightedPctSum / totalWeight) : 0
  }

  let attendanceScore = 0
  const attendanceBreakdown: AttendanceBreakdown = {
    present: 0,
    total: 0,
    score: 0,
  }

  // Attendance credit: full credit for present/wfh/remote, partial for late/half_day, zero for absent.
  const ATTENDANCE_CREDIT: Record<string, number> = {
    present: 1.0,
    wfh: 1.0,
    remote: 1.0,
    late: 0.5,
    half_day: 0.5,
    absent: 0,
  }

  let leaveRequestQuery = supabase
    .from("leave_requests")
    .select("start_date, end_date")
    .eq("user_id", params.userId)
    .eq("status", "approved")

  let attendanceQuery = supabase.from("attendance_records").select("status, date").eq("user_id", params.userId)

  if (cycle) {
    leaveRequestQuery = leaveRequestQuery.gte("end_date", cycle.start_date).lte("start_date", cycle.end_date)
    attendanceQuery = attendanceQuery.gte("date", cycle.start_date).lte("date", cycle.end_date)
  }

  const [{ data: approvedLeaves }, { data: attendance }] = await Promise.all([leaveRequestQuery, attendanceQuery])

  const leaveDateSet = new Set<string>()
  if (approvedLeaves) {
    for (const leave of approvedLeaves) {
      const effectiveStart = cycle ? cycle.start_date : leave.start_date
      const effectiveEnd = cycle ? cycle.end_date : leave.end_date
      const leaveStart = new Date(Math.max(new Date(leave.start_date).getTime(), new Date(effectiveStart).getTime()))
      const leaveEnd = new Date(Math.min(new Date(leave.end_date).getTime(), new Date(effectiveEnd).getTime()))
      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        leaveDateSet.add(d.toISOString().slice(0, 10))
      }
    }
  }

  if (attendance && attendance.length > 0) {
    const scorableRecords = attendance.filter((row) => !leaveDateSet.has(String(row.date || "").slice(0, 10)))

    let creditSum = 0
    for (const row of scorableRecords) {
      const status = String(row.status || "absent").toLowerCase()
      creditSum += ATTENDANCE_CREDIT[status] ?? 0
    }
    attendanceBreakdown.present = scorableRecords.filter((row) =>
      ["present", "wfh", "remote"].includes(String(row.status || "").toLowerCase())
    ).length
    attendanceBreakdown.total = scorableRecords.length
    attendanceScore = scorableRecords.length > 0 ? roundScore((creditSum / scorableRecords.length) * 100) : 100
    attendanceBreakdown.score = attendanceScore
  }

  let cbtScore = 0
  let cbtQuery = supabase
    .from("performance_reviews")
    .select("cbt_score")
    .eq("user_id", params.userId)
    .not("cbt_score", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (params.cycleId) {
    cbtQuery = cbtQuery.eq("review_cycle_id", params.cycleId)
  }

  const { data: cbtRows } = await cbtQuery
  if (cbtRows && cbtRows.length > 0) {
    cbtScore = roundScore(Number(cbtRows[0]?.cbt_score) || 0)
  }

  // ── Fix 2: 360° feedback — blend peer + manager for behaviour ──
  // Query manager behaviour score from performance_reviews
  let managerBehaviourScore = 0
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
    managerBehaviourScore = roundScore(Number(behaviourRows[0]?.behaviour_score) || 0)
  }

  // Query peer feedback scores (360° feedback) if the table exists
  let peerBehaviourScore = 0
  let peerFeedbackCount = 0
  const { data: peerRows } = await supabase
    .from("peer_feedback")
    .select("score")
    .eq("subject_user_id", params.userId)
    .eq("status", "submitted")
    .not("score", "is", null)

  if (peerRows && peerRows.length > 0) {
    peerFeedbackCount = peerRows.length
    peerBehaviourScore = roundScore(peerRows.reduce((sum, row) => sum + (Number(row.score) || 0), 0) / peerRows.length)
  }

  // Blend: if peer feedback exists, 60% manager + 40% peer. Otherwise 100% manager.
  const behaviourScore =
    peerFeedbackCount > 0 ? roundScore(managerBehaviourScore * 0.6 + peerBehaviourScore * 0.4) : managerBehaviourScore

  // ── Fix 1: CBT dead weight redistribution ──
  // When CBT = 0 (system not built yet), redistribute its 10% proportionally
  // among the other 3 components so scores aren't artificially deflated.
  // Standard weights: KPI=70%, CBT=10%, Attendance=10%, Behaviour=10%
  let finalScore: number
  let appliedWeights: { kpi: number; cbt: number; attendance: number; behaviour: number }

  if (cbtScore === 0) {
    // Redistribute 10% among KPI(70), Attendance(10), Behaviour(10) = 90 total
    // New: KPI=77.78%, Attendance=11.11%, Behaviour=11.11%
    const w = { kpi: 70 / 90, cbt: 0, attendance: 10 / 90, behaviour: 10 / 90 }
    finalScore = roundScore(kpiScore * w.kpi + attendanceScore * w.attendance + behaviourScore * w.behaviour)
    appliedWeights = {
      kpi: roundScore(w.kpi * 100),
      cbt: 0,
      attendance: roundScore(w.attendance * 100),
      behaviour: roundScore(w.behaviour * 100),
    }
  } else {
    finalScore = roundScore(kpiScore * 0.7 + cbtScore * 0.1 + attendanceScore * 0.1 + behaviourScore * 0.1)
    appliedWeights = { kpi: 70, cbt: 10, attendance: 10, behaviour: 10 }
  }

  return {
    user_id: params.userId,
    cycle_id: params.cycleId ?? null,
    kpi_score: kpiScore,
    cbt_score: cbtScore,
    attendance_score: attendanceScore,
    behaviour_score: behaviourScore,
    manager_behaviour_score: managerBehaviourScore,
    peer_behaviour_score: peerBehaviourScore,
    peer_feedback_count: peerFeedbackCount,
    final_score: finalScore,
    applied_weights: appliedWeights,
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

  // ── Fix 3: Derive department membership from actual work records, not current profile ──
  // This prevents department transfers from breaking scores. A person who worked in
  // Department A during Q1 but transferred to Department B in Q2 will still count
  // toward Department A's Q1 score — because their tasks/goals have department = A.
  //
  // We also include currently-active employees as a fallback (for people with no
  // records yet in the cycle who are still valid department members).
  const employeeIdSet = new Set<string>()

  // Source 1: Users with tasks in this department during the cycle
  let taskUsersQuery = supabase
    .from("tasks")
    .select("assigned_to")
    .eq("department", params.department)
    .not("assigned_to", "is", null)
  if (cycle) {
    taskUsersQuery = taskUsersQuery.gte("created_at", cycle.start_date).lte("created_at", cycle.end_date)
  }
  const { data: taskUsers } = await taskUsersQuery
  for (const row of taskUsers || []) {
    if (row.assigned_to) employeeIdSet.add(row.assigned_to)
  }

  // Source 2: Users with goals linked to this department's review cycle
  let goalUsersQuery = supabase.from("goals_objectives").select("user_id").eq("approval_status", "approved")
  if (params.cycleId) {
    goalUsersQuery = goalUsersQuery.eq("review_cycle_id", params.cycleId)
  }
  const { data: goalUsers } = await goalUsersQuery
  // We need to cross-reference goal users with department; goals don't have a department
  // column, so we include currently active employees as well (Source 3 below).

  // Source 3: Currently active employees (fallback — catches new hires with no records yet)
  const { data: activeEmployees } = await supabase
    .from("profiles")
    .select("id")
    .eq("department", params.department)
    .eq("employment_status", "active")
  for (const row of activeEmployees || []) {
    employeeIdSet.add(row.id)
  }

  // Also add goal users who are/were in this department
  const activeIds = new Set((activeEmployees || []).map((row) => row.id))
  for (const row of goalUsers || []) {
    if (activeIds.has(row.user_id)) employeeIdSet.add(row.user_id)
  }

  const employeeIds = Array.from(employeeIdSet)

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

  // Query action items from the TASKS table (unified model), not the legacy action_items table.
  // Use category='weekly_action' which is what weekly-report-sourced action items are tagged as.
  let actionItemsQuery = supabase
    .from("tasks")
    .select("status")
    .eq("department", params.department)
    .eq("category", "weekly_action")

  // Help desk tickets — scored from source table directly (separate lifecycle)
  let helpDeskQuery = supabase.from("help_desk_tickets").select("status").eq("service_department", params.department)

  // Task/project delivery: only manual and project_task sources.
  // Excludes help_desk (scored separately above) AND weekly_action items (scored separately above)
  // to prevent double-counting.
  let taskDeliveryQuery = supabase
    .from("tasks")
    .select("status, source_type, category")
    .eq("department", params.department)
    .in("source_type", ["manual", "project_task"])
    .or("category.is.null,category.neq.weekly_action")

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

  // ── Fix 3: Calibration — compute department mean/stddev for normalisation ──
  // ── Fix 4: Percentile ranking — rank employees within the department ──
  const sortedScores = individualScores
    .map((s) => ({ user_id: s.user_id, final_score: s.final_score }))
    .sort((a, b) => b.final_score - a.final_score)

  const mean =
    individualScores.length > 0
      ? roundScore(individualScores.reduce((sum, s) => sum + s.final_score, 0) / individualScores.length)
      : 0

  const variance =
    individualScores.length > 1
      ? individualScores.reduce((sum, s) => sum + Math.pow(s.final_score - mean, 2), 0) / (individualScores.length - 1)
      : 0
  const stddev = roundScore(Math.sqrt(variance))

  // Percentile: rank / total * 100 (higher = better)
  const rankings = sortedScores.map((entry, index) => ({
    user_id: entry.user_id,
    final_score: entry.final_score,
    rank: index + 1,
    percentile: roundScore(((sortedScores.length - index) / sortedScores.length) * 100),
    // Z-score: how many stddevs above/below mean (for cross-dept calibration)
    z_score: stddev > 0 ? roundScore((entry.final_score - mean) / stddev) : 0,
  }))

  return {
    department: params.department,
    cycle_id: params.cycleId ?? null,
    department_kpi: departmentKpi,
    department_pms: departmentPms,
    breakdown,
    employee_count: employeeIds.length,
    calibration: { mean, stddev },
    rankings,
  }
}
