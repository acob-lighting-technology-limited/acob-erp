import { createClient } from "@/lib/supabase/client"

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
}

export interface ActionTrackerMetadata {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profile: any = null
  if (user) {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    profile = p
  }

  const { data: depts } = await supabase.from("profiles").select("department").not("department", "is", null)
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
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("category", "weekly_action")
    .eq("week_number", week)
    .eq("year", year)
    .order("department", { ascending: true })

  if (deptFilter !== "all") {
    query = query.eq("department", deptFilter)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return { tasks: data || [] }
}

export function getDeptStatus(tasks: ActionTask[], dept: string) {
  const deptActions = tasks.filter((t) => t.department === dept)
  if (deptActions.length === 0)
    return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
  if (deptActions.every((a) => a.status === "completed"))
    return { label: "Finished", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
  if (deptActions.some((a) => a.status === "in_progress" || a.status === "completed"))
    return { label: "Started", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" }
  return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
}

export function getStatusColor(status: string) {
  if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  if (status === "in_progress") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  if (status === "not_started") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
  return "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
}
