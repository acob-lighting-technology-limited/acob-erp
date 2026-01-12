import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminTasksContent, type Task, type Staff, type Project, type UserProfile } from "./admin-tasks-content"

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

  // Build query based on role
  let tasksQuery = supabase.from("tasks").select("*").order("created_at", { ascending: false })

  // Filter by department for leads
  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    tasksQuery = tasksQuery.in("department", profile.lead_departments)
  }

  // Fetch staff - leads can only see staff in their departments
  let staffQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, company_email, department")
    .order("last_name", { ascending: true })

  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    staffQuery = staffQuery.in("department", profile.lead_departments)
  }

  const [tasksResult, staffResult, projectsResult] = await Promise.all([
    tasksQuery,
    staffQuery,
    supabase.from("projects").select("id, project_name").order("project_name", { ascending: true }),
  ])

  if (tasksResult.error || staffResult.error || projectsResult.error) {
    console.error("Error loading data:", tasksResult.error || staffResult.error || projectsResult.error)
    return { tasks: [], staff: [], projects: [], departments: [], userProfile }
  }

  // Fetch task assignments and user details (simplified for SSR)
  const tasksWithUsers = await Promise.all(
    (tasksResult.data || []).map(async (task: any) => {
      const taskData: any = { ...task }

      // For individual tasks, fetch assigned user
      if (task.assignment_type === "individual" && task.assigned_to) {
        const { data: userProfileData } = await supabase
          .from("profiles")
          .select("first_name, last_name, department")
          .eq("id", task.assigned_to)
          .single()

        taskData.assigned_to_user = userProfileData
      }

      // For multiple-user tasks, fetch all assignments
      if (task.assignment_type === "multiple") {
        const { data: assignments } = await supabase.from("task_assignments").select("user_id").eq("task_id", task.id)

        if (assignments && assignments.length > 0) {
          const userIds = assignments.map((a: any) => a.user_id)
          const { data: userProfiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, department")
            .in("id", userIds)

          const { data: completions } = await supabase
            .from("task_user_completion")
            .select("user_id")
            .eq("task_id", task.id)

          const completedUserIds = new Set(completions?.map((c: any) => c.user_id) || [])

          taskData.assigned_users =
            userProfiles?.map((p: any) => ({
              ...p,
              completed: completedUserIds.has(p.id),
            })) || []
        }
      }

      return taskData
    })
  )

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
    departments = Array.from(new Set(staffResult.data?.map((s: any) => s.department).filter(Boolean))) as string[]
    departments.sort()
  }

  return {
    tasks: filteredTasks as Task[],
    staff: (staffResult.data || []) as Staff[],
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
    staff: Staff[]
    projects: Project[]
    departments: string[]
    userProfile: UserProfile
  }

  return (
    <AdminTasksContent
      initialTasks={pageData.tasks}
      initialStaff={pageData.staff}
      initialProjects={pageData.projects}
      initialDepartments={pageData.departments}
      userProfile={pageData.userProfile}
    />
  )
}
