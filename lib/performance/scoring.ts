import type { SupabaseClient } from "@supabase/supabase-js"
import { loadAttendanceStartDate } from "@/lib/hr/attendance-start"
import { toLocalISODate } from "@/lib/utils/date"
import { deriveUnifiedAttendanceStatus, normalizeStoredAttendanceStatus } from "@/lib/hr/attendance-status"
import { AttendancePolicy, DEFAULT_ATTENDANCE_POLICY } from "@/lib/org-config"
import {
  computeAttendanceDay,
  getEffectiveAttendanceStartDate,
  isPositiveAttendanceStatus,
  netDayHoursFor,
} from "@/lib/hr/attendance-ssot"
import { pickCurrentCycle, getCoveredQuarterlyCycles, isQuarterlyCycle, rollupQuarterlyScores } from "@/lib/pms/cadence"
import { computeWeightedTaskScore, isTaskInCycle } from "@/lib/tasks/scoring"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

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

export type AttendanceBreakdownDay = {
  id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  total_hours: number | null
  status: string
}

export type AttendanceBreakdown = {
  present: number
  total: number
  score: number | null
  late_penalty_total_ngn?: number
  late_penalty_steps_total?: number
  late_days?: number
  records?: AttendanceBreakdownDay[]
}

type DepartmentMetricBreakdown = {
  average_individual_kpi: number | null
  learning_capability_score: number | null
  attendance_compliance_score: number | null
  behaviour_leadership_score: number | null
}

type ReviewCycleRow = {
  id: string
  name?: string | null
  start_date: string
  end_date: string
  status?: string | null
  review_type?: string | null
}

type PerformanceReviewScoreRow = {
  id: string
  created_at: string
  reviewer_id: string | null
  status: string | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
}

type MetricValue = number | null

type TaskScoreRow = {
  id: string
  goal_id: string | null
  title: string | null
  status: string | null
  weight: number | null
  rating: number | null
  assignment_type: string | null
  assigned_to: string | null
  assigned_by: string | null
  department: string | null
  task_end_date: string | null
  due_date: string | null
  created_at: string | null
  is_archived: boolean | null
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

function averageDefined(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return null
  return roundScore(valid.reduce((sum, value) => sum + value, 0) / valid.length)
}

function weightedScore(
  parts: Array<{ key: "kpi" | "cbt" | "attendance" | "behaviour"; value: MetricValue; weight: number }>
) {
  const available = parts.filter((part) => typeof part.value === "number" && Number.isFinite(part.value))
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0)

  if (totalWeight <= 0) {
    return {
      finalScore: null as number | null,
      appliedWeights: { kpi: 0, cbt: 0, attendance: 0, behaviour: 0 },
    }
  }

  const weightedValue = available.reduce((sum, part) => sum + (part.value as number) * part.weight, 0) / totalWeight
  const appliedWeights = { kpi: 0, cbt: 0, attendance: 0, behaviour: 0 }

  for (const part of available) {
    appliedWeights[part.key] = roundScore((part.weight / totalWeight) * 100)
  }

  return {
    finalScore: roundScore(weightedValue),
    appliedWeights,
  }
}

async function getCycleWindow(supabase: SupabaseClient, cycleId?: string | null): Promise<ReviewCycleRow | null> {
  if (cycleId === "all" || cycleId === "__all__") {
    return null
  }
  if (cycleId) {
    const { data } = await supabase
      .from("review_cycles")
      .select("id, name, start_date, end_date, status")
      .eq("id", cycleId)
      .maybeSingle<ReviewCycleRow>()
    if (data) return data
  }

  // 1. Fall back to the quarterly cycle covering today. PMS is scored quarterly,
  // and half-year/annual cycles span the same dates — picking "the newest active
  // cycle" regardless of cadence lets those windows drive quarterly scores.
  const { data: activeCycles } = await supabase
    .from("review_cycles")
    .select("id, name, start_date, end_date, status, review_type")
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .returns<(ReviewCycleRow & { review_type: string | null })[]>()

  const activeCycle = pickCurrentCycle(activeCycles || [], toLocalISODate(), "quarterly")
  if (activeCycle) return activeCycle

  // 2. Fall back to the most recent quarterly cycle of any status
  const { data: allCycles } = await supabase
    .from("review_cycles")
    .select("id, name, start_date, end_date, status, review_type")
    .order("start_date", { ascending: false })
    .returns<(ReviewCycleRow & { review_type: string | null })[]>()

  return pickCurrentCycle(allCycles || [], toLocalISODate(), "quarterly")
}

export async function computeIndividualPerformanceScore(
  supabase: SupabaseClient,
  params: { userId: string; cycleId?: string | null }
) {
  const cycle = await getCycleWindow(supabase, params.cycleId)

  // Load attendance policy configuration
  const { data: settingRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "attendance_policy")
    .maybeSingle()
  // Merged over the defaults so a policy row saved before a field existed still
  // resolves that field rather than coming back undefined.
  const policy = { ...DEFAULT_ATTENDANCE_POLICY, ...((settingRow?.value as Partial<AttendancePolicy>) ?? {}) }
  const netDay = netDayHoursFor(policy)

  const { data: profile } = await supabase
    .from("profiles")
    .select("attendance_exempt, nysc_cds_day")
    .eq("id", params.userId)
    .maybeSingle<{ attendance_exempt?: boolean | null; nysc_cds_day?: string | null }>()

  // The MD's own tasks have no one above them to rate them honestly, so they
  // are left out of the MD's KPI (see lib/tasks/rating-authority.ts).
  const { data: mdDept } = await supabase
    .from("departments")
    .select("department_head_id")
    .eq("department_code", "MD")
    .maybeSingle<{ department_head_id: string | null }>()
  const userIsMd = Boolean(mdDept?.department_head_id) && mdDept?.department_head_id === params.userId

  // ── KPI / Task Performance (70%) ──────────────────────────────
  // Weighted task scoring: SUM(weight * rating/5) / SUM(weight).
  //
  // Every task carries a compulsory weight, so a task needs no goal to count —
  // goals and projects are groupings for reporting, not a gate on scoring, and
  // their own weight_pct/priority no longer influence any score (weighting the
  // same work twice would make the result impossible to explain).
  //
  // A task belongs to the cycle its DUE DATE falls in, not its completion date:
  // work due in March stays March's whether it is delivered late or not at all.

  const { data: userCompletions } = await supabase
    .from("task_user_completion")
    .select("task_id")
    .eq("user_id", params.userId)
  const userCompletedTaskIds = new Set((userCompletions || []).map((row) => row.task_id))

  const TASK_FIELDS =
    "id, goal_id, title, status, weight, rating, assignment_type, assigned_to, assigned_by, department, task_end_date, due_date, created_at, is_archived"

  // Only work with this person's name on it. There is no department-wide query
  // here any more: it pulled in every task filed under their department and,
  // through the fallback below, credited or penalised the whole team for one
  // person's row. A task for several people is fanned out into one row each, so
  // each of them is scored on their own copy and nobody carries someone else's.
  const [{ data: assignedTasks }, { data: completedTasks }] = await Promise.all([
    supabase.from("tasks").select(TASK_FIELDS).eq("assigned_to", params.userId).eq("is_archived", false),
    userCompletedTaskIds.size > 0
      ? supabase.from("tasks").select(TASK_FIELDS).in("id", Array.from(userCompletedTaskIds)).eq("is_archived", false)
      : Promise.resolve({ data: [] as TaskScoreRow[] }),
  ])

  const tasksById = new Map<string, TaskScoreRow>()
  for (const row of [...(assignedTasks || []), ...(completedTasks || [])]) {
    if (row?.id) tasksById.set(row.id, row as TaskScoreRow)
  }

  const scorableTasks: TaskScoreRow[] = []
  for (const task of tasksById.values()) {
    if (cycle && !isTaskInCycle(task, cycle.start_date, cycle.end_date)) continue
    if (userIsMd && task.assigned_to === params.userId && task.assigned_by === params.userId) continue

    // A task counts for this employee when they are the named assignee, or when
    // they individually recorded their own completion of it.
    if (task.assigned_to !== params.userId && !userCompletedTaskIds.has(task.id)) continue

    scorableTasks.push(task)
  }

  const taskScore = computeWeightedTaskScore(scorableTasks)
  // A finalised review's stored kpi_score still wins further down; this is the
  // live figure the continuous dashboard shows until then.
  let kpiScore: number | null = taskScore.score

  // Grouped by goal for the KPI breakdown table. Tasks with no goal are real
  // scored work too, so they get their own row rather than being hidden.
  const goalBreakdown: GoalScoreBreakdown[] = []
  const tasksByGoalId = new Map<string, TaskScoreRow[]>()
  for (const task of scorableTasks) {
    const key = task.goal_id || ""
    const bucket = tasksByGoalId.get(key) || []
    bucket.push(task)
    tasksByGoalId.set(key, bucket)
  }

  const goalIds = Array.from(tasksByGoalId.keys()).filter(Boolean)
  const goalMetaById = new Map<
    string,
    { title: string; priority: string | null; is_system_generated: boolean | null }
  >()
  if (goalIds.length > 0) {
    const { data: goalRows } = await supabase
      .from("goals_objectives")
      .select("id, title, priority, is_system_generated")
      .in("id", goalIds)
    for (const goal of goalRows || []) {
      goalMetaById.set(goal.id, {
        title: goal.title,
        priority: goal.priority,
        is_system_generated: goal.is_system_generated,
      })
    }
  }

  for (const [goalId, groupTasks] of tasksByGoalId) {
    const group = computeWeightedTaskScore(groupTasks)
    const meta = goalId ? goalMetaById.get(goalId) : undefined
    goalBreakdown.push({
      goal_id: goalId,
      title: meta?.title || (goalId ? "Unknown goal" : "Ad-hoc / Operational tasks"),
      priority: String(meta?.priority || "medium"),
      // Goal weighting no longer drives the score; the group's total task
      // weight is what actually decides how much this row moved the number.
      priority_weight: group.availablePoints,
      custom_weight_pct: null,
      linked_tasks_total: group.taskCount,
      linked_tasks_completed: groupTasks.filter((task) => task.status === "completed").length,
      goal_progress_pct: group.score ?? 0,
      effective_kpi_pct: group.score ?? 0,
      is_system_generated: meta?.is_system_generated === true,
    })
  }

  goalBreakdown.sort((a, b) => b.priority_weight - a.priority_weight)

  let attendanceScore: number | null = null
  const attendanceBreakdown: AttendanceBreakdown = {
    present: 0,
    total: 0,
    score: null,
    late_penalty_total_ngn: 0,
    late_penalty_steps_total: 0,
    late_days: 0,
  }

  let leaveRequestQuery = supabase
    .from("leave_requests")
    .select("start_date, end_date")
    .eq("user_id", params.userId)
    .eq("status", "approved")

  let attendanceQuery = supabase
    .from("attendance_records")
    .select("id, status, date, clock_in, clock_out, total_hours, waived")
    .eq("user_id", params.userId)

  // One row per person from the start-dates view (first clock-in or manual edit).
  const earliestRecordQuery = loadAttendanceStartDate(supabase, params.userId).then((date) => ({
    data: date ? { date } : null,
  }))

  if (cycle) {
    leaveRequestQuery = leaveRequestQuery.gte("end_date", cycle.start_date).lte("start_date", cycle.end_date)
    attendanceQuery = attendanceQuery.gte("date", cycle.start_date).lte("date", cycle.end_date)
  }

  let exemptionQuery = supabase
    .from("attendance_exempt_periods")
    .select("start_date, end_date")
    .eq("user_id", params.userId)

  let holidayQuery = supabase.from("holiday_calendar").select("holiday_date")

  let closureQuery = supabase.from("attendance_early_closures").select("closure_date, close_time")

  if (cycle) {
    exemptionQuery = exemptionQuery.lte("start_date", cycle.end_date).gte("end_date", cycle.start_date)
    holidayQuery = holidayQuery.gte("holiday_date", cycle.start_date).lte("holiday_date", cycle.end_date)
    closureQuery = closureQuery.gte("closure_date", cycle.start_date).lte("closure_date", cycle.end_date)
  }

  const [
    { data: approvedLeaves },
    { data: attendance },
    { data: earliestRecord },
    { data: exemptionPeriods },
    { data: holidayRows },
    { data: closureRows },
  ] = await Promise.all([
    leaveRequestQuery,
    attendanceQuery,
    earliestRecordQuery,
    exemptionQuery,
    holidayQuery,
    closureQuery,
  ])

  const effectiveAttendanceStartDate = getEffectiveAttendanceStartDate({
    earliestLogDate: earliestRecord?.date ?? null,
    isExempt: Boolean(profile?.attendance_exempt),
  })

  // date → early-closure time (org-wide). Missing table/permission is non-fatal.
  const closureByDate = new Map<string, string>()
  for (const row of (closureRows as Array<{ closure_date: string; close_time: string }> | null) || []) {
    if (row.closure_date && row.close_time) closureByDate.set(row.closure_date, String(row.close_time).slice(0, 5))
  }

  const leaveDateSet = new Set<string>()
  if (approvedLeaves) {
    for (const leave of approvedLeaves) {
      const effectiveStart = cycle ? cycle.start_date : leave.start_date
      const effectiveEnd = cycle ? cycle.end_date : leave.end_date
      const leaveStart = new Date(Math.max(new Date(leave.start_date).getTime(), new Date(effectiveStart).getTime()))
      const leaveEnd = new Date(Math.min(new Date(leave.end_date).getTime(), new Date(effectiveEnd).getTime()))
      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        leaveDateSet.add(toLocalISODate(d))
      }
    }
  }

  const exemptionDateSet = new Set<string>()
  for (const period of exemptionPeriods || []) {
    const start = cycle ? cycle.start_date : period.start_date
    const end = cycle ? cycle.end_date : period.end_date
    const periodStart = new Date(Math.max(new Date(period.start_date).getTime(), new Date(start).getTime()))
    const periodEnd = new Date(Math.min(new Date(period.end_date).getTime(), new Date(end).getTime()))
    for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
      exemptionDateSet.add(toLocalISODate(d))
    }
  }

  const holidayDateSet = new Set((holidayRows || []).map((row) => row.holiday_date))

  // Build a date-keyed lookup for attendance records so we can score each workday,
  // including days with no record (those count as absent, 0 credit).
  const recordByDate = new Map<string, NonNullable<typeof attendance>[number]>()
  for (const row of attendance || []) {
    const day = String(row.date || "").slice(0, 10)
    if (day) recordByDate.set(day, row)
  }

  // Enumerate all Mon–Fri dates in the cycle window, capped at today.
  // When no cycle is available we cannot derive the range, so leave workdays empty
  // and the score falls back to null (no data).
  const todayIso = toLocalISODate()
  const workdays: string[] = []
  if (cycle) {
    const rangeEnd = cycle.end_date < todayIso ? cycle.end_date : todayIso
    for (let d = new Date(cycle.start_date); toLocalISODate(d) <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) workdays.push(toLocalISODate(d))
    }
  } else if (params.cycleId === "all" || params.cycleId === "__all__") {
    const { data: allCycles } = await supabase
      .from("review_cycles")
      .select("start_date, end_date, review_type, name")
      .order("start_date", { ascending: true })

    if (allCycles && allCycles.length > 0) {
      const targetCycles = allCycles.filter((c) => isQuarterlyCycle(c.review_type, c.name))
      const cyclesToUse = targetCycles.length > 0 ? targetCycles : allCycles
      const workdaySet = new Set<string>()

      for (const c of cyclesToUse) {
        if (!c.start_date || !c.end_date) continue
        const rangeEnd = c.end_date < todayIso ? c.end_date : todayIso
        for (let d = new Date(c.start_date); toLocalISODate(d) <= rangeEnd; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay()
          if (dow !== 0 && dow !== 6) {
            workdaySet.add(toLocalISODate(d))
          }
        }
      }
      workdays.push(...Array.from(workdaySet).sort())
    }
  }

  if (workdays.length > 0) {
    let creditSum = 0
    const latePenaltyTotalNgn = 0
    let latePenaltyStepsTotal = 0
    let lateDays = 0
    let presentDays = 0
    let scorableDays = 0
    const dailyRecords: AttendanceBreakdownDay[] = []

    for (const day of workdays) {
      if (!effectiveAttendanceStartDate || day < effectiveAttendanceStartDate) continue
      if (holidayDateSet.has(day)) continue
      if (leaveDateSet.has(day)) continue
      if (Boolean(profile?.attendance_exempt) || exemptionDateSet.has(day)) continue

      if (profile?.nysc_cds_day) {
        const parts = day.split("-").map(Number)
        if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          const dowIndex = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay()
          const DOW_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
          if (DOW_NAMES[dowIndex] === profile.nysc_cds_day.toLowerCase().trim()) continue
        }
      }

      const row = recordByDate.get(day)
      const rawStoredStatus = String((row as { status?: string | null })?.status || "").toLowerCase()

      // Approved Leave Without Pay (LWOP): exclude from scorable days so it doesn't penalize attendance score
      if (rawStoredStatus === "leave_without_pay" || rawStoredStatus === "lwop") continue

      // Skip today if the employee is still clocked in (unfinished day).
      if (day === todayIso && row?.clock_in && !row?.clock_out) {
        dailyRecords.push({
          id: (row as { id?: string })?.id || `in-progress-${day}`,
          date: day,
          clock_in: row.clock_in,
          clock_out: null,
          total_hours: null,
          status: "in_progress",
        })
        continue
      }

      scorableDays++

      if (!row) {
        // No record for this workday — counts as absent (0 credit).
        dailyRecords.push({
          id: `absent-${day}`,
          date: day,
          clock_in: null,
          clock_out: null,
          total_hours: null,
          status: "absent",
        })
        continue
      }

      const earlyClose = closureByDate.get(day)
      const status = deriveUnifiedAttendanceStatus(
        { record: row, recordDate: day, earlyClosure: earlyClose ? { closeTime: earlyClose } : null },
        policy
      )

      // Hours-lost model, shared with payroll and HR reports via the SSOT.
      // LEWP/LWP/IWP forgives corresponding penalty brackets.
      const dayResult = computeAttendanceDay({
        status,
        clockIn: row.clock_in,
        clockOut: row.clock_out,
        policy,
        earlyCloseTime: earlyClose ?? null,
        earlyOutApproved: rawStoredStatus === "early_departure_with_permission" || rawStoredStatus === "lewp",
        incompleteApproved: rawStoredStatus === "incomplete_with_permission" || rawStoredStatus === "iwp",
        latenessApproved: rawStoredStatus === "lateness_with_permission" || rawStoredStatus === "lwp",
      })
      creditSum += dayResult.hoursWorked / netDay

      if (status !== "absent" && dayResult.lateBracket > 0) {
        lateDays += 1
        latePenaltyStepsTotal += dayResult.lateBracket
      }

      if (isPositiveAttendanceStatus(status) || isPositiveAttendanceStatus(rawStoredStatus)) {
        presentDays++
      }

      dailyRecords.push({
        id: (row as { id?: string })?.id || `record-${day}`,
        date: day,
        clock_in: row.clock_in ?? null,
        clock_out: row.clock_out ?? null,
        total_hours: (row as { total_hours?: number | null })?.total_hours ?? null,
        status: status,
      })
    }

    const coveredDates = new Set(dailyRecords.map((r) => r.date))
    for (const row of attendance || []) {
      const day = String(row.date || "").slice(0, 10)
      if (day && !coveredDates.has(day)) {
        dailyRecords.push({
          id: (row as { id?: string })?.id || `extra-${day}`,
          date: day,
          clock_in: row.clock_in ?? null,
          clock_out: row.clock_out ?? null,
          total_hours: (row as { total_hours?: number | null })?.total_hours ?? null,
          status: row.status || "present",
        })
      }
    }

    dailyRecords.sort((a, b) => b.date.localeCompare(a.date))
    attendanceBreakdown.records = dailyRecords

    attendanceBreakdown.present = presentDays
    attendanceBreakdown.total = scorableDays
    attendanceScore = scorableDays > 0 ? roundScore((creditSum / scorableDays) * 100) : null
    attendanceBreakdown.score = attendanceScore
    attendanceBreakdown.late_penalty_total_ngn = latePenaltyTotalNgn
    attendanceBreakdown.late_penalty_steps_total = latePenaltyStepsTotal
    attendanceBreakdown.late_days = lateDays
  } else if (attendance && attendance.length > 0) {
    attendanceBreakdown.records = (
      attendance as Array<{
        id?: string
        date?: string | null
        clock_in?: string | null
        clock_out?: string | null
        total_hours?: number | null
        status?: string | null
      }>
    )
      .map((row) => ({
        id: row.id || `rec-${row.date}`,
        date: String(row.date || "").slice(0, 10),
        clock_in: row.clock_in ?? null,
        clock_out: row.clock_out ?? null,
        total_hours: row.total_hours ?? null,
        status: row.status || "unknown",
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  let latestReviewQuery = supabase
    .from("performance_reviews")
    .select("id, created_at, reviewer_id, status, kpi_score, cbt_score, attendance_score, behaviour_score")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })

  // The RESOLVED cycle, not params.cycleId: on the default view (no cycle in
  // the URL) params.cycleId is undefined, so this filter used to be skipped
  // entirely and the newest review from ANY cycle overwrote the live scores.
  const scopedCycleId = cycle?.id ?? params.cycleId ?? null
  if (scopedCycleId) {
    latestReviewQuery = latestReviewQuery.eq("review_cycle_id", scopedCycleId)
  }

  const { data: latestReviewRows } = await latestReviewQuery.returns<PerformanceReviewScoreRow[]>()
  // A person may carry both a self-review and a reviewer's review for the same
  // cycle (the unique constraint is per reviewer, not per person/cycle). The
  // reviewer's review is authoritative, so it wins regardless of which was
  // submitted more recently; among same-authority rows, the newest wins.
  const reviewerReview =
    (latestReviewRows || []).find((row) => row.reviewer_id && row.reviewer_id !== params.userId) || null
  const latestReview = reviewerReview || latestReviewRows?.[0] || null
  // Only a completed review by someone else may replace the live KPI. A draft
  // used to do it too, which froze KPI at whatever it was when the draft was
  // first saved — later task ratings never reached the score.
  const finalReview = reviewerReview?.status === "completed" ? reviewerReview : null

  // A missed CBT counts as zero, but only once the quarter has closed, only if
  // that quarter's CBT actually ran (it has questions), and only for someone
  // who had started before it ended. Otherwise its 10% is redistributed, which
  // made skipping the exam score better than sitting it and doing badly.
  // cbt_questions is admin-only under RLS, hence the service client for what
  // is only an existence check.
  async function cyclesWithCbt(cycleIds: string[]): Promise<Set<string>> {
    if (cycleIds.length === 0) return new Set()
    const { data } = await getServiceRoleClientOrFallback(supabase)
      .from("cbt_questions")
      .select("review_cycle_id")
      .in("review_cycle_id", cycleIds)
    return new Set((data || []).map((row) => row.review_cycle_id as string))
  }
  const missedCbtCountsAsZero = (quarter: { end_date?: string | null }) =>
    Boolean(
      quarter.end_date &&
        quarter.end_date < todayIso &&
        effectiveAttendanceStartDate &&
        effectiveAttendanceStartDate <= quarter.end_date
    )

  let cbtScore: number | null = null

  // Check if target cycle is a multi-quarter rollup (Biannual / Annual)
  const isMultiQuarter = Boolean(cycle && !isQuarterlyCycle(cycle.review_type, cycle.name))

  if (isMultiQuarter && cycle?.start_date && cycle?.end_date) {
    const { data: quarterlyCycleRows } = await supabase
      .from("review_cycles")
      .select("id, name, start_date, end_date, review_type")
      .order("start_date", { ascending: true })

    const coveredQuarters = getCoveredQuarterlyCycles(cycle, quarterlyCycleRows || [])
    const targetQuarterIds = coveredQuarters.map((q) => q.id)

    if (targetQuarterIds.length > 0) {
      const [{ data: quarterlyReviews }, { data: quarterlyAttempts }] = await Promise.all([
        supabase
          .from("performance_reviews")
          .select("review_cycle_id, cbt_score")
          .eq("user_id", params.userId)
          .in("review_cycle_id", targetQuarterIds)
          .not("cbt_score", "is", null),
        supabase
          .from("cbt_attempts")
          .select("review_cycle_id, score")
          .eq("profile_id", params.userId)
          .eq("status", "submitted")
          .in("review_cycle_id", targetQuarterIds),
      ])

      const scoreByQuarter = new Map<string, number>()
      for (const row of quarterlyReviews || []) {
        if (typeof row.cbt_score === "number" && Number.isFinite(row.cbt_score)) {
          scoreByQuarter.set(row.review_cycle_id, Number(row.cbt_score))
        }
      }
      for (const row of quarterlyAttempts || []) {
        if (
          row.review_cycle_id &&
          !scoreByQuarter.has(row.review_cycle_id) &&
          typeof row.score === "number" &&
          Number.isFinite(row.score)
        ) {
          scoreByQuarter.set(row.review_cycle_id, Number(row.score))
        }
      }

      const heldQuarters = await cyclesWithCbt(targetQuarterIds)
      const quarterlyValues = coveredQuarters.map((quarter) => {
        const score = scoreByQuarter.get(quarter.id)
        if (score !== undefined) return score
        return heldQuarters.has(quarter.id) && missedCbtCountsAsZero(quarter) ? 0 : undefined
      })
      cbtScore = rollupQuarterlyScores(quarterlyValues)
    }
  }

  // Fallback to single cycle lookup if quarterly or if direct review exists
  if (cbtScore === null && latestReview && typeof latestReview.cbt_score === "number") {
    cbtScore = roundScore(Number(latestReview.cbt_score) || 0)
  }

  if (cbtScore === null) {
    let cbtQuery = supabase
      .from("performance_reviews")
      .select("cbt_score")
      .eq("user_id", params.userId)
      .not("cbt_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)

    if (cycle?.id) {
      cbtQuery = cbtQuery.eq("review_cycle_id", cycle.id)
    }

    const { data: cbtRows } = await cbtQuery
    if (cbtRows && cbtRows.length > 0) {
      cbtScore = roundScore(Number(cbtRows[0]?.cbt_score) || 0)
    }
  }

  if (cbtScore === null) {
    let cbtAttemptQuery = supabase
      .from("cbt_attempts")
      .select("score")
      .eq("profile_id", params.userId)
      .eq("status", "submitted")

    if (cycle?.id) {
      cbtAttemptQuery = cbtAttemptQuery.eq("review_cycle_id", cycle.id)
    }

    const { data: cbtAttempts } = await cbtAttemptQuery.order("submitted_at", { ascending: false }).limit(1)

    if (cbtAttempts && cbtAttempts.length > 0 && typeof cbtAttempts[0]?.score === "number") {
      cbtScore = roundScore(Number(cbtAttempts[0].score))
    }
  }

  if (cbtScore === null && !isMultiQuarter && cycle && missedCbtCountsAsZero(cycle)) {
    const held = await cyclesWithCbt([cycle.id])
    if (held.has(cycle.id)) cbtScore = 0
  }

  // ── 360° feedback — blend peer + manager for behaviour ──
  // The manager's figure comes from someone else's review only: a self-review
  // is not a manager assessment.
  const managerBehaviourScore: number | null =
    reviewerReview && typeof reviewerReview.behaviour_score === "number"
      ? roundScore(Number(reviewerReview.behaviour_score) || 0)
      : null

  // Query peer feedback scores (360° feedback) if the table exists
  let peerBehaviourScore: number | null = null
  let peerFeedbackCount = 0
  // Scoped to the cycle like every other component; without this, feedback
  // from any period blended into every cycle's behaviour score.
  let peerQuery = supabase
    .from("peer_feedback")
    .select("score")
    .eq("subject_user_id", params.userId)
    .eq("status", "submitted")
    .not("score", "is", null)

  if (scopedCycleId) {
    peerQuery = peerQuery.eq("review_cycle_id", scopedCycleId)
  }

  const { data: peerRows } = await peerQuery

  if (peerRows && peerRows.length > 0) {
    peerFeedbackCount = peerRows.length
    peerBehaviourScore = roundScore(peerRows.reduce((sum, row) => sum + (Number(row.score) || 0), 0) / peerRows.length)
  }

  // Blend: if peer feedback exists, 60% manager + 40% peer. Otherwise 100% manager.
  let behaviourScore: number | null = null
  if (managerBehaviourScore !== null && peerBehaviourScore !== null && peerFeedbackCount > 0) {
    behaviourScore = roundScore(managerBehaviourScore * 0.6 + peerBehaviourScore * 0.4)
  } else if (managerBehaviourScore !== null) {
    behaviourScore = managerBehaviourScore
  } else if (peerBehaviourScore !== null) {
    behaviourScore = peerBehaviourScore
  }

  // The behaviour blend above is final. This used to be followed by a second
  // assignment from the review's behaviour_score, which silently threw the
  // peer share away whenever a manager review existed.
  if (finalReview && typeof finalReview.kpi_score === "number") {
    kpiScore = roundScore(Number(finalReview.kpi_score) || 0)
  }

  // Standard weights: KPI=70%, CBT=10%, Attendance=10%, Behaviour=10%. A
  // component with no data has its weight redistributed over the others.
  const { finalScore, appliedWeights } = weightedScore([
    { key: "kpi", value: kpiScore, weight: 70 },
    { key: "cbt", value: cbtScore, weight: 10 },
    { key: "attendance", value: attendanceScore, weight: 10 },
    { key: "behaviour", value: behaviourScore, weight: 10 },
  ])

  return {
    user_id: params.userId,
    cycle_id: cycle?.id ?? params.cycleId ?? null,
    cycle_name: cycle?.name ?? null,
    cycle_start_date: cycle?.start_date ?? null,
    cycle_end_date: cycle?.end_date ?? null,
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

export type DepartmentMemberScore = {
  user_id: string
  final_score: number | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
}

/**
 * Department PMS is the average of its members' final individual PMS scores.
 *
 * It used to re-weight its own blend (individual KPI plus weekly action items,
 * help desk resolution and a task completion ratio), but those are all tasks
 * that already sit in each member's weighted KPI, so the same work was counted
 * twice and the department read differently from the people in it. Averaging
 * the finals means a department of 70, 80 and 90 reads 80, checkable by hand.
 *
 * Members are the active employees whose profile department is this one, so
 * each person counts in exactly one department. Nobody with no score yet is
 * averaged in as zero; they are simply not scored.
 */
export async function computeDepartmentPerformanceScore(
  supabase: SupabaseClient,
  params: { department: string; cycleId?: string | null }
) {
  const cycle = await getCycleWindow(supabase, params.cycleId)
  // The resolved cycle, so the default view (no cycle in the URL) still scopes
  // every member to the same window instead of each resolving its own.
  const scopedCycleId = cycle?.id ?? params.cycleId ?? null

  const { data: memberRows } = await supabase
    .from("profiles")
    .select("id")
    .eq("department", params.department)
    .eq("employment_status", "active")

  const employeeIds = (memberRows || []).map((row) => row.id as string)

  const individualScores =
    employeeIds.length > 0
      ? await Promise.all(
          employeeIds.map((userId) => computeIndividualPerformanceScore(supabase, { userId, cycleId: scopedCycleId }))
        )
      : []

  const members: DepartmentMemberScore[] = individualScores.map((score) => ({
    user_id: score.user_id,
    final_score: score.final_score,
    kpi_score: score.kpi_score,
    cbt_score: score.cbt_score,
    attendance_score: score.attendance_score,
    behaviour_score: score.behaviour_score,
  }))

  const departmentPms = averageDefined(members.map((member) => member.final_score))

  // Component averages are a breakdown, not a recipe: each member's missing
  // components are redistributed individually, so these will not multiply
  // back out to department_pms exactly.
  const breakdown: DepartmentMetricBreakdown = {
    average_individual_kpi: averageDefined(members.map((member) => member.kpi_score)),
    learning_capability_score: averageDefined(members.map((member) => member.cbt_score)),
    attendance_compliance_score: averageDefined(members.map((member) => member.attendance_score)),
    behaviour_leadership_score: averageDefined(members.map((member) => member.behaviour_score)),
  }

  const sortedScores = members
    .filter(
      (member): member is DepartmentMemberScore & { final_score: number } => typeof member.final_score === "number"
    )
    .map((member) => ({ user_id: member.user_id, final_score: member.final_score }))
    .sort((a, b) => b.final_score - a.final_score)

  const mean = departmentPms ?? 0

  const variance =
    sortedScores.length > 1
      ? sortedScores.reduce((sum, s) => sum + Math.pow(s.final_score - mean, 2), 0) / (sortedScores.length - 1)
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
    cycle_id: scopedCycleId,
    department_kpi: breakdown.average_individual_kpi,
    department_pms: departmentPms,
    breakdown,
    employee_count: employeeIds.length,
    scored_count: sortedScores.length,
    members,
    calibration: { mean, stddev },
    rankings,
  }
}
