import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { computeDepartmentPerformanceScore } from "@/lib/performance/scoring"
import { getRequestScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { pickCurrentCycle } from "@/lib/pms/cadence"
import { toLocalISODate } from "@/lib/utils/date"
import type { ReviewCycleOption } from "@/app/(app)/pms/_lib"

type DepartmentRow = {
  name: string
}

type ScopedProfileRow = {
  id: string
  department: string | null
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

export async function getAdminPmsData(requestedCycleId?: string) {
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

  const [{ data: allDepartments }, { data: cycleRows }] = await Promise.all([
    scopedDepts === null
      ? supabase.from("departments").select("name").order("name", { ascending: true }).returns<DepartmentRow[]>()
      : Promise.resolve({ data: [] as DepartmentRow[] }),
    supabase
      .from("review_cycles")
      .select("id, name, start_date, end_date, status, review_type")
      .order("start_date", { ascending: false }),
  ])

  const cycles: ReviewCycleOption[] = (cycleRows || []).map((c) => ({
    id: c.id,
    name: c.name || "Review Cycle",
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status || "closed",
    reviewType: c.review_type ?? null,
  }))

  const cadenceCycles = cycles.map((cycle) => ({
    id: cycle.id,
    review_type: cycle.reviewType,
    start_date: cycle.startDate,
    end_date: cycle.endDate,
  }))

  const activeCycleId =
    (requestedCycleId && cycles.some((c) => c.id === requestedCycleId) ? requestedCycleId : null) ||
    pickCurrentCycle(cadenceCycles, toLocalISODate(), "quarterly")?.id ||
    cycles[0]?.id ||
    null

  if (scopedDepts === null) {
    // Global admin — see all departments
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

  const departmentScores: DepartmentScore[] = await Promise.all(
    departments.map((department) => computeDepartmentPerformanceScore(supabase, { department, cycleId: activeCycleId }))
  )

  // Company figures average every individual, not every department: averaging
  // departments let a 3-person team weigh as much as a 20-person one. Each
  // person sits in exactly one department, so nobody is counted twice.
  const members = departmentScores.flatMap((entry) => entry.members)

  return {
    departments,
    scopedUserCount: scopedUserIds.length,
    departmentScores,
    cycles,
    activeCycleId,
    summary: {
      overallPms: average(members.map((member) => member.final_score)),
      overallKpi: average(members.map((member) => member.kpi_score)),
      attendance: average(members.map((member) => member.attendance_score)),
      cbt: average(members.map((member) => member.cbt_score)),
      behaviour: average(members.map((member) => member.behaviour_score)),
    },
  }
}
