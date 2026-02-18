import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  AdminTasksContent,
  type Task,
  type employee,
  type Project,
  type UserProfile,
} from "./management/admin-tasks-content"

async function getAdminTasksData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("role, lead_departments").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    return { redirect: "/dashboard" as const }
  }

  const userProfile: UserProfile = {
    role: profile.role,
    lead_departments: profile.lead_departments,
  }

  // Build query based on role - exclude weekly action tracker items
  let tasksQuery = supabase
    .from("tasks")
    .select("*")
    .neq("category", "weekly_action")
    .order("created_at", { ascending: false })

  // Fetch employee - leads can only see employee in their departments
  let employeeQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, company_email, department")
    .order("last_name", { ascending: true })

  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    employeeQuery = employeeQuery.in("department", profile.lead_departments)
  }

  const [tasksResult, employeeResult, projectsResult] = await Promise.all([
    tasksQuery,
    employeeQuery,
    supabase.from("projects").select("id, project_name").order("project_name", { ascending: true }),
  ])

  if (tasksResult.error || employeeResult.error || projectsResult.error) {
    console.error("Error loading data:", tasksResult.error || employeeResult.error || projectsResult.error)
    return { tasks: [], employee: [], projects: [], departments: [], userProfile }
  }

  // 1. Collect all IDs for batch queries
  const allTaskIds = tasksResult.data?.map((t: any) => t.id) || []
  const allIndivUserIds = Array.from(
    new Set(
      tasksResult.data
        ?.filter((t: any) => t.assignment_type === "individual" && t.assigned_to)
        .map((t: any) => t.assigned_to) || []
    )
  ) as string[]

  // 2. Fetch profiles for individual assignments
  const { data: indivProfiles } =
    allIndivUserIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name, department").in("id", allIndivUserIds)
      : { data: [] }
  const indivProfileMap = new Map(indivProfiles?.map((p: any) => [p.id, p]))

  // 3. Fetch task assignments for multiple tasks
  const multTaskIds = tasksResult.data?.filter((t: any) => t.assignment_type === "multiple").map((t: any) => t.id) || []
  const { data: allTaskAssignments } =
    multTaskIds.length > 0
      ? await supabase.from("task_assignments").select("task_id, user_id").in("task_id", multTaskIds)
      : { data: [] }

  // 4. Fetch profiles for multiple assigned users
  const multUserIds = Array.from(new Set(allTaskAssignments?.map((a: any) => a.user_id) || []))
  const { data: multProfiles } =
    multUserIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name, department").in("id", multUserIds)
      : { data: [] }
  const multProfileMap = new Map(multProfiles?.map((p: any) => [p.id, p]))

  // 5. Fetch all completions
  const { data: allCompletions } =
    allTaskIds.length > 0
      ? await supabase.from("task_user_completion").select("task_id, user_id").in("task_id", allTaskIds)
      : { data: [] }

  // Grouping logic
  const assignmentsByTask = new Map()
  allTaskAssignments?.forEach((a: any) => {
    if (!assignmentsByTask.has(a.task_id)) assignmentsByTask.set(a.task_id, [])
    assignmentsByTask.get(a.task_id).push(a.user_id)
  })

  const completionsByTask = new Map()
  allCompletions?.forEach((c: any) => {
    if (!completionsByTask.has(c.task_id)) completionsByTask.set(c.task_id, new Set())
    completionsByTask.get(c.task_id).add(c.user_id)
  })

  // 6. Reconstruct tasksWithUsers
  const tasksWithUsers = (tasksResult.data || []).map((task: any) => {
    const taskData: any = { ...task }

    if (task.assignment_type === "individual" && task.assigned_to) {
      taskData.assigned_to_user = indivProfileMap.get(task.assigned_to)
    }

    if (task.assignment_type === "multiple") {
      const userIds = assignmentsByTask.get(task.id) || []
      const taskComps = completionsByTask.get(task.id) || new Set()
      taskData.assigned_users = userIds.map((uid: string) => {
        const prof = multProfileMap.get(uid)
        return {
          ...prof,
          completed: taskComps.has(uid),
        }
      })
    }
    return taskData
  })

  // For leads, filter tasks strictly by their departments
  let filteredTasks = tasksWithUsers || []
  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    filteredTasks = filteredTasks.filter((task: any) => {
      if (task.department && profile.lead_departments.includes(task.department)) {
        return true
      }
      if (task.assigned_to_user?.department && profile.lead_departments.includes(task.assigned_to_user.department)) {
        return true
      }
      if (task.assigned_users && task.assigned_users.length > 0) {
        return task.assigned_users.some((u: any) => u.department && profile.lead_departments.includes(u.department))
      }
      return false
    })
  }

  // Get unique departments
  let departments: string[] = []
  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    departments = profile.lead_departments.sort()
  } else {
    departments = Array.from(new Set(employeeResult.data?.map((s: any) => s.department).filter(Boolean))) as string[]
    departments.sort()
  }

  return {
    tasks: filteredTasks as Task[],
    employee: (employeeResult.data || []) as employee[],
    projects: (projectsResult.data || []) as Project[],
    departments,
    userProfile,
  }
}

export default async function AdminTasksPage() {
  const data = await getAdminTasksData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    tasks: Task[]
    employee: employee[]
    projects: Project[]
    departments: string[]
    userProfile: UserProfile
  }

  return (
    <AdminTasksContent
      initialTasks={pageData.tasks}
      initialemployee={pageData.employee}
      initialProjects={pageData.projects}
      initialDepartments={pageData.departments}
      userProfile={pageData.userProfile}
    />
  )
}
