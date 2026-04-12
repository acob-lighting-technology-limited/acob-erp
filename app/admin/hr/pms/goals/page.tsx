import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminGoalsContent } from "./admin-goals-content"
import type { Goal } from "@/app/(app)/goals/page"

type GoalWithCycle = Goal & {
  cycle?: {
    id: string
    name: string
    review_type: string | null
  } | null
}

async function getAdminGoalPageData() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department, is_department_lead, lead_departments")
    .eq("id", user.id)
    .maybeSingle<{
      role?: string | null
      department?: string | null
      is_department_lead?: boolean | null
      lead_departments?: string[] | null
    }>()

  const role = String(profile?.role || "").toLowerCase()
  const isAdminLike = ["developer", "admin", "super_admin"].includes(role)
  const managedDepartments = isAdminLike
    ? (await supabase.from("departments").select("name").order("name", { ascending: true })).data?.map(
        (row) => row.name
      ) || []
    : Array.from(new Set([profile?.department, ...(profile?.lead_departments || [])].filter(Boolean) as string[]))

  const [goalsResult, cyclesResult] = await Promise.all([
    managedDepartments.length > 0
      ? supabase
          .from("goals_objectives")
          .select("*")
          .in("department", managedDepartments)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Goal[] }),
    supabase.from("review_cycles").select("id, name, review_type").order("start_date", { ascending: false }),
  ])

  const cycles = cyclesResult.data || []
  const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]))
  const goals = ((goalsResult.data || []) as Goal[]).map((goal) => ({
    ...goal,
    cycle: goal.review_cycle_id ? cyclesById.get(goal.review_cycle_id) || null : null,
  })) as GoalWithCycle[]

  return {
    goals,
    cycles,
    canCreateGoal: isAdminLike || Boolean(profile?.is_department_lead),
    managedDepartments,
  }
}

export default async function AdminPmsGoalsPage() {
  const data = await getAdminGoalPageData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  return (
    <AdminGoalsContent
      initialGoals={data.goals}
      cycles={data.cycles}
      canCreateGoal={data.canCreateGoal}
      managedDepartments={data.managedDepartments}
    />
  )
}
