import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { computeDepartmentPerformanceScore } from "@/lib/performance/scoring"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"

type DepartmentRow = {
  name: string
}

type ScopedProfileRow = {
  id: string
  department: string | null
}

type GoalRow = {
  department?: string | null
  approval_status: string | null
  status: string | null
}

type DepartmentScore = Awaited<ReturnType<typeof computeDepartmentPerformanceScore>>

function round(value: number) {
  return Math.round(value * 100) / 100
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return null
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
}

export async function getAdminPmsData() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Use the middleware-injected scope (single source of truth)
  const scope = await getRequestScope()
  if (!scope) redirect("/profile")

  const scopedDepts = getScopedDepartments(scope)
  let departments: string[] = []

  if (scopedDepts === null) {
    // Global admin — see all departments
    const { data: allDepartments } = await supabase
      .from("departments")
      .select("name")
      .order("name", { ascending: true })
      .returns<DepartmentRow[]>()
    departments = (allDepartments || []).map((row) => row.name).filter(Boolean)
  } else {
    // Lead or admin in lead mode — scope to managed departments (with aliases)
    departments = scopedDepts.length > 0 ? scopedDepts : []
  }

  const { data: scopedProfiles } =
    departments.length > 0
      ? await supabase
          .from("profiles")
          .select("id, department")
          .in("department", departments)
          .returns<ScopedProfileRow[]>()
      : { data: [] as ScopedProfileRow[] }

  const scopedUsers = scopedProfiles || []
  const scopedUserIds = scopedUsers.map((row) => row.id)

  const { data: goalRows } =
    departments.length > 0
      ? await supabase
          .from("goals_objectives")
          .select("department, approval_status, status")
          .in("department", departments)
          .returns<GoalRow[]>()
      : { data: [] as GoalRow[] }

  const departmentScores: DepartmentScore[] = await Promise.all(
    departments.map((department) => computeDepartmentPerformanceScore(supabase, { department }))
  )

  const goalBreakdown = departments.map((department) => {
    const rows = (goalRows || []).filter((row) => (row.department || "Unassigned") === department)
    return {
      department,
      total: rows.length,
      approved: rows.filter((row) => row.approval_status === "approved").length,
      completed: rows.filter((row) => row.status === "completed").length,
    }
  })

  return {
    departments,
    scopedUserCount: scopedUserIds.length,
    departmentScores,
    goalBreakdown,
    summary: {
      overallPms: average(departmentScores.map((entry) => entry.department_pms)),
      overallKpi: average(departmentScores.map((entry) => entry.department_kpi)),
      attendance: average(departmentScores.map((entry) => entry.breakdown.attendance_compliance_score)),
      cbt: average(departmentScores.map((entry) => entry.breakdown.learning_capability_score)),
      behaviour: average(departmentScores.map((entry) => entry.breakdown.behaviour_leadership_score)),
      approvedGoals: goalBreakdown.reduce((sum, item) => sum + item.approved, 0),
    },
  }
}
