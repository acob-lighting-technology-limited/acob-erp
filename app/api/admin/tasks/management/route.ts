import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import type { Task } from "@/types/task"

export const dynamic = "force-dynamic"

type ProfileNameRow = { id: string; first_name: string | null; last_name: string | null; department: string | null }

// Admin task-management list: non-weekly-action, non-action-item tasks,
// enriched with the assignee's profile and linked goal title. Department
// scoping (lead vs global) is applied client-side against userProfile, same
// as before — this route only removes the direct browser Supabase reads.
export async function GET() {
  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return scopeResult.response
  const { scope, supabase } = scopeResult
  if (!scope.isAdminLike && !scope.isDepartmentLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const db = getServiceRoleClientOrFallback(supabase)
  const { data: tasksData, error: tasksError } = await db
    .from("tasks")
    .select("*")
    .neq("category", "weekly_action")
    .order("created_at", { ascending: false })
  if (tasksError) return NextResponse.json({ error: tasksError.message }, { status: 500 })

  const tasks = (tasksData ?? []).filter((task) => String(task.source_type || "") !== "action_item") as Task[]

  const assigneeIds = Array.from(new Set(tasks.map((t) => t.assigned_to).filter((id): id is string => Boolean(id))))
  let profileMap = new Map<string, ProfileNameRow>()
  if (assigneeIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, first_name, last_name, department")
      .in("id", assigneeIds)
    profileMap = new Map(((profiles ?? []) as ProfileNameRow[]).map((p) => [p.id, p]))
  }

  const enriched = tasks.map((task) => ({
    ...task,
    assigned_to_user:
      task.assignment_type === "individual" && task.assigned_to ? profileMap.get(task.assigned_to) : undefined,
  }))

  const goalIds = Array.from(new Set(enriched.map((task) => task.goal_id).filter(Boolean))) as string[]
  const kpiIds = Array.from(new Set(enriched.map((task) => task.kpi_id).filter(Boolean))) as string[]

  let goalMap = new Map<string, string>()
  type KpiInfo = { id: string; measure: string; strategic_objective: string; strategic_priority: string }
  let kpiMap = new Map<string, KpiInfo>()

  const [goalsRes, kpisRes] = await Promise.all([
    goalIds.length > 0 ? db.from("goals_objectives").select("id, title").in("id", goalIds) : { data: [] },
    kpiIds.length > 0
      ? db.from("corporate_kpis").select("id, measure, strategic_objective, strategic_priority").in("id", kpiIds)
      : { data: [] },
  ])

  if (goalsRes.data) {
    goalMap = new Map((goalsRes.data as { id: string; title: string }[]).map((g) => [g.id, g.title]))
  }
  if (kpisRes.data) {
    kpiMap = new Map((kpisRes.data as KpiInfo[]).map((k) => [k.id, k]))
  }

  const result = enriched.map((task) => {
    const copy = {
      ...task,
      goal_title: task.goal_id ? (goalMap.get(task.goal_id) ?? null) : null,
    }
    if (task.kpi_id) {
      const kpi = kpiMap.get(task.kpi_id)
      if (kpi) {
        copy.kpi_measure = kpi.measure
        copy.kpi_pillar = kpi.strategic_priority
        copy.kpi_objective = kpi.strategic_objective
        if (!copy.goal_title) {
          copy.goal_title = kpi.strategic_objective
        }
      }
    }
    return copy
  })

  return NextResponse.json({ data: result })
}
