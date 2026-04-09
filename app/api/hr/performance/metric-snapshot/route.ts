import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { computeDepartmentPerformanceScore, computeIndividualPerformanceScore } from "@/lib/performance/scoring"

const log = logger("hr-performance-metric-snapshot")

const SnapshotQuerySchema = z.object({
  metric: z.enum(["kpi", "goals", "attendance", "behaviour"]),
  cycle_id: z.string().trim().optional().nullable(),
  view: z.enum(["individual", "department", "cycle"]).optional().default("individual"),
})

type AccessProfile = {
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

type DepartmentRow = {
  name: string
}

type ScopedUserRow = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
}

type ReviewCycleRow = {
  id: string
  name: string
  review_type: string | null
  start_date: string | null
  end_date: string | null
}

type GoalRow = {
  user_id: string
  review_cycle_id: string | null
  approval_status: string | null
  status: string | null
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function fullName(user: ScopedUserRow) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed employee"
}

async function getScopedContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department, is_department_lead, lead_departments")
    .eq("id", userId)
    .maybeSingle<AccessProfile>()

  const role = String(profile?.role || "").toLowerCase()
  const isAdminLike = ["developer", "admin", "super_admin"].includes(role)

  let departments: string[] = []
  if (isAdminLike) {
    const { data: departmentRows } = await supabase
      .from("departments")
      .select("name")
      .order("name", { ascending: true })
      .returns<DepartmentRow[]>()
    departments = (departmentRows || []).map((row) => row.name).filter(Boolean)
  } else {
    departments = Array.from(
      new Set([profile?.department, ...(profile?.lead_departments || [])].filter(Boolean) as string[])
    )
  }

  const { data: users } =
    departments.length > 0
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name, department")
          .in("department", departments)
          .order("first_name", { ascending: true })
          .returns<ScopedUserRow[]>()
      : { data: [] as ScopedUserRow[] }

  const { data: cycles } = await supabase
    .from("review_cycles")
    .select("id, name, review_type, start_date, end_date")
    .order("start_date", { ascending: false })
    .returns<ReviewCycleRow[]>()

  return {
    departments,
    users: users || [],
    cycles: cycles || [],
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = SnapshotQuerySchema.safeParse({
      metric: new URL(request.url).searchParams.get("metric"),
      cycle_id: new URL(request.url).searchParams.get("cycle_id"),
      view: new URL(request.url).searchParams.get("view") || "individual",
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 })
    }

    const metric = parsed.data.metric
    const view = parsed.data.view
    const context = await getScopedContext(supabase, user.id)
    const selectedCycleId = parsed.data.cycle_id || context.cycles[0]?.id || null
    const selectedCycle = context.cycles.find((cycle) => cycle.id === selectedCycleId) || null
    const userIds = context.users.map((entry) => entry.id)
    const usersById = new Map(context.users.map((entry) => [entry.id, entry]))

    let individualRows: Record<string, unknown>[] = []
    let departmentRows: Record<string, unknown>[] = []
    let cycleRows: Record<string, unknown>[] = []

    if (metric === "goals") {
      const { data: goals } =
        userIds.length > 0
          ? await supabase
              .from("goals_objectives")
              .select("user_id, review_cycle_id, approval_status, status")
              .in("user_id", userIds)
              .returns<GoalRow[]>()
          : { data: [] as GoalRow[] }

      const goalsForSelectedCycle = selectedCycleId
        ? (goals || []).filter((row) => row.review_cycle_id === selectedCycleId)
        : goals || []

      const goalsByUser = new Map<string, GoalRow[]>()
      for (const goal of goalsForSelectedCycle) {
        const existing = goalsByUser.get(goal.user_id) || []
        existing.push(goal)
        goalsByUser.set(goal.user_id, existing)
      }

      const goalsIndividualRows = context.users.map((entry) => {
        const rows = goalsByUser.get(entry.id) || []
        return {
          user_id: entry.id,
          employee: fullName(entry),
          department: entry.department || "Unassigned",
          cycle: selectedCycle?.name || "Current",
          total_goals: rows.length,
          approved_goals: rows.filter((row) => row.approval_status === "approved").length,
          completed_goals: rows.filter((row) => row.status === "completed").length,
        }
      })
      individualRows = goalsIndividualRows.filter((row) => Number(row.total_goals || 0) > 0)

      const goalsByDepartment = new Map<string, GoalRow[]>()
      for (const goal of goalsForSelectedCycle) {
        const owner = usersById.get(goal.user_id)
        const department = owner?.department || "Unassigned"
        const existing = goalsByDepartment.get(department) || []
        existing.push(goal)
        goalsByDepartment.set(department, existing)
      }

      departmentRows = context.departments
        .map((department) => {
          const rows = goalsByDepartment.get(department) || []
          return {
            department,
            cycle: selectedCycle?.name || "Current",
            total_goals: rows.length,
            approved_goals: rows.filter((row) => row.approval_status === "approved").length,
            completed_goals: rows.filter((row) => row.status === "completed").length,
          }
        })
        .filter((row) => Number(row.total_goals || 0) > 0)

      if (view === "cycle") {
        const cycle = selectedCycle
        const rows = cycle ? (goals || []).filter((goal) => goal.review_cycle_id === cycle.id) : []
        cycleRows =
          cycle && rows.length > 0
            ? [
                {
                  cycle_id: cycle.id,
                  cycle: cycle.name,
                  review_type: cycle.review_type || "-",
                  total_goals: rows.length,
                  approved_goals: rows.filter((row) => row.approval_status === "approved").length,
                  completed_goals: rows.filter((row) => row.status === "completed").length,
                },
              ]
            : []
      }
    } else {
      const candidateUserIds =
        selectedCycleId && context.users.length > 0
          ? await (async () => {
              if (metric === "kpi") {
                const { data: goalRows } = await supabase
                  .from("goals_objectives")
                  .select("user_id")
                  .eq("review_cycle_id", selectedCycleId)
                  .eq("approval_status", "approved")
                  .in(
                    "user_id",
                    context.users.map((entry) => entry.id)
                  )
                return Array.from(new Set((goalRows || []).map((row) => row.user_id)))
              }
              if (metric === "attendance") {
                const cycleWindow = context.cycles.find((cycle) => cycle.id === selectedCycleId)
                if (!cycleWindow?.start_date || !cycleWindow?.end_date) return []
                const { data: attendanceRows } = await supabase
                  .from("attendance_records")
                  .select("user_id")
                  .in(
                    "user_id",
                    context.users.map((entry) => entry.id)
                  )
                  .gte("date", cycleWindow.start_date)
                  .lte("date", cycleWindow.end_date)
                return Array.from(new Set((attendanceRows || []).map((row) => row.user_id)))
              }
              const { data: reviewRows } = await supabase
                .from("performance_reviews")
                .select("user_id")
                .eq("review_cycle_id", selectedCycleId)
                .not("behaviour_score", "is", null)
                .in(
                  "user_id",
                  context.users.map((entry) => entry.id)
                )
              return Array.from(new Set((reviewRows || []).map((row) => row.user_id)))
            })()
          : []

      const candidateUsers = context.users.filter((entry) => candidateUserIds.includes(entry.id))

      const individualScores =
        selectedCycleId && candidateUsers.length > 0
          ? await Promise.all(
              candidateUsers.map(async (entry) => ({
                user: entry,
                score: await computeIndividualPerformanceScore(supabase, {
                  userId: entry.id,
                  cycleId: selectedCycleId,
                }),
              }))
            )
          : []

      individualRows = individualScores
        .map(({ user: entry, score }) => ({
          user_id: entry.id,
          employee: fullName(entry),
          department: entry.department || "Unassigned",
          cycle: selectedCycle?.name || "Current",
          metric_value:
            metric === "kpi"
              ? score.kpi_score
              : metric === "attendance"
                ? score.attendance_score
                : score.behaviour_score,
          kpi_score: score.kpi_score,
          attendance_score: score.attendance_score,
          behaviour_score: score.behaviour_score,
          _goal_count: score.breakdown.goals.length,
          _attendance_total: score.breakdown.attendance.total,
        }))
        .filter((row) => {
          if (metric === "kpi") return Number(row._goal_count || 0) > 0
          if (metric === "attendance") return Number(row._attendance_total || 0) > 0
          return Number(row.behaviour_score || 0) > 0
        })
        .map(({ _goal_count, _attendance_total, ...row }) => row)

      const departmentScores =
        selectedCycleId && (view === "department" || view === "cycle") && context.departments.length > 0
          ? await Promise.all(
              context.departments.map((department) =>
                computeDepartmentPerformanceScore(supabase, { department, cycleId: selectedCycleId })
              )
            )
          : []

      departmentRows = departmentScores
        .map((entry) => ({
          department: entry.department,
          cycle: selectedCycle?.name || "Current",
          employee_count: entry.employee_count,
          metric_value:
            metric === "kpi"
              ? entry.department_kpi
              : metric === "attendance"
                ? entry.breakdown.attendance_compliance_score
                : entry.breakdown.behaviour_leadership_score,
        }))
        .filter((row) => Number(row.employee_count || 0) > 0 && Number(row.metric_value || 0) > 0)

      if (view === "cycle" && selectedCycle) {
        const weightedEntries = departmentScores.filter((row) => row.employee_count > 0)
        const denominator = weightedEntries.reduce((sum, row) => sum + row.employee_count, 0)
        const numerator = weightedEntries.reduce((sum, row) => {
          const value =
            metric === "kpi"
              ? row.department_kpi
              : metric === "attendance"
                ? row.breakdown.attendance_compliance_score
                : row.breakdown.behaviour_leadership_score
          return sum + value * row.employee_count
        }, 0)
        cycleRows =
          denominator > 0
            ? [
                {
                  cycle_id: selectedCycle.id,
                  cycle: selectedCycle.name,
                  review_type: selectedCycle.review_type || "-",
                  metric_value: round(numerator / denominator),
                  departments_counted: weightedEntries.length,
                },
              ]
            : []
      }
    }

    return NextResponse.json({
      data: {
        metric,
        selected_cycle_id: selectedCycleId,
        users: context.users.map((entry) => ({
          id: entry.id,
          name: fullName(entry),
          department: entry.department || "Unassigned",
        })),
        departments: context.departments,
        cycles: context.cycles,
        rows: {
          individual: individualRows,
          department: departmentRows,
          cycle: cycleRows,
        },
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/hr/performance/metric-snapshot")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
