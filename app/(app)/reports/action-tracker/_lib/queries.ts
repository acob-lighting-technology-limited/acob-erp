import { createClient } from "@/lib/supabase/client"

import { apiFetch } from "@/lib/api-client"
export interface ActionTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  department: string
  due_date?: string
  week_number: number
  year: number
  /**
   * weekly_report = parsed from the department's "Tasks for New Week".
   * management_directive = raised by management at the general meeting.
   */
  origin?: "weekly_report" | "management_directive"
  meeting_date?: string
  timeline_text?: string
  assignees?: { id: string; name: string; department?: string }[]
  /** What is preventing completion, with optional supporting evidence attached. */
  blocker_note?: string
  blocker_reported_at?: string
  blocker_reported_by_name?: string
  evidence_count?: number
}

export interface ActionTrackerMetadata {
  profile: {
    id?: string
    role?: string | null
    department?: string | null
    is_department_lead?: boolean | null
    lead_departments?: string[] | null
    admin_routes?: string[] | null
  } | null
  allDepartments: string[]
}

export interface ActionTrackerTasksResult {
  tasks: ActionTask[]
}

export async function fetchActionTrackerMetadata(
  supabase: ReturnType<typeof createClient>
): Promise<ActionTrackerMetadata> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: ActionTrackerMetadata["profile"] = null
  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, role, department, is_department_lead, lead_departments, admin_routes")
      .eq("id", user.id)
      .single()
    profile = p
  }

  // staff_directory, not profiles: profiles RLS limits a plain employee to their
  // own row, which collapsed the department filter to a single entry.
  const { data: depts } = await supabase.from("staff_directory").select("department").not("department", "is", null)
  const allDepartments = depts
    ? (Array.from(new Set(depts.map((d) => d.department)))
        .filter(Boolean)
        .sort() as string[])
    : []

  return { profile, allDepartments }
}

export async function fetchActionTrackerTasks(
  supabase: ReturnType<typeof createClient>,
  week: number,
  year: number,
  deptFilter: string
): Promise<ActionTrackerTasksResult> {
  const params = new URLSearchParams({ week: String(week), year: String(year), dept: deptFilter })
  const response = await apiFetch(`/api/reports/action-tracker?${params.toString()}`, { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as { data?: ActionTask[]; error?: string } | null
  if (!response.ok) throw new Error(payload?.error || "Failed to fetch action items")
  return { tasks: payload?.data || [] }
}

export function getDeptStatus(tasks: ActionTask[], dept: string) {
  const deptActions = tasks.filter((t) => t.department === dept)
  if (deptActions.length === 0) return { label: "Pending", color: "bg-muted text-muted-foreground" }
  if (deptActions.every((a) => a.status === "completed"))
    return { label: "Finished", color: "bg-success/15 text-success" }
  if (deptActions.some((a) => a.status === "in_progress" || a.status === "completed"))
    return { label: "Started", color: "bg-info/15 text-info" }
  return { label: "Pending", color: "bg-muted text-muted-foreground" }
}

export function getStatusColor(status: string) {
  if (status === "completed") return "bg-success/15 text-success"
  if (status === "in_progress") return "bg-info/15 text-info"
  if (status === "not_started") return "bg-warning/15 text-warning"
  return "bg-muted text-muted-foreground"
}
