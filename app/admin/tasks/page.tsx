import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import {
  AdminTasksContent,
  type Task,
  type employee,
  type Project,
  type UserProfile,
} from "./management/admin-tasks-content"
import { listAssignableProfiles } from "@/lib/workforce/assignment-policy"

import { logger } from "@/lib/logger"

const log = logger("tasks")

type TaskAssignmentRow = {
  task_id: string
  user_id: string
}

type ProfileDepartmentRow = {
  id: string
  first_name: string
  last_name: string
  department: string | null
}

async function getAdminTasksData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) {
    return { redirect: "/profile" as const }
  }
  const departmentScope = getDepartmentScope(scope, "general")

  const userProfile: UserProfile = {
    id: user.id,
    role: scope.role,
    department: scope.department,
    lead_departments: scope.leadDepartments,
    managed_departments: scope.managedDepartments,
  }

  // Build query based on role - exclude weekly action tracker items
  const tasksQuery = dataClient
    .from("tasks")
    .select("*")
    .neq("category", "weekly_action")
    .order("created_at", { ascending: false })

  // Fetch employee - leads can only see employee in their departments
  const [tasksResult, employeeResult, projectsResult] = await Promise.all([
    tasksQuery,
    listAssignableProfiles(dataClient, {
      select:
        "id, first_name, last_name, company_email, department, employment_status, is_department_lead, lead_departments",
      departmentScope,
      allowLegacyNullStatus: false,
    }),
    dataClient.from("projects").select("id, project_name").order("project_name", { ascending: true }),
  ])

  if (tasksResult.error || employeeResult.error || projectsResult.error) {
    log.error("Error loading data:", tasksResult.error || employeeResult.error || projectsResult.error)
    return { tasks: [], employee: [], projects: [], departments: [], userProfile }
  }

  // 1. Collect all IDs for batch queries
  const allTaskIds = ((tasksResult.data as Task[] | null) || []).map((t) => t.id)
  const allIndivUserIds = Array.from(
    new Set(
      ((tasksResult.data as Task[] | null) || [])
        .filter((t) => t.assignment_type === "individual" && t.assigned_to)
        .map((t) => t.assigned_to) || []
    )
  ) as string[]

  // 2. Fetch profiles for individual assignments
  const { data: indivProfiles } =
    allIndivUserIds.length > 0
      ? await dataClient.from("profiles").select("id, first_name, last_name, department").in("id", allIndivUserIds)
      : { data: [] }
  const indivProfileMap = new Map(((indivProfiles as ProfileDepartmentRow[] | null) || []).map((p) => [p.id, p]))

  // 3. Fetch task assignments for multiple tasks
  const multTaskIds =
    ((tasksResult.data as Task[] | null) || []).filter((t) => t.assignment_type === "multiple").map((t) => t.id) || []
  const { data: allTaskAssignments } =
    multTaskIds.length > 0
      ? await dataClient.from("task_assignments").select("task_id, user_id").in("task_id", multTaskIds)
      : { data: [] }

  // 4. Fetch profiles for multiple assigned users
  const multUserIds = Array.from(
    new Set(((allTaskAssignments as TaskAssignmentRow[] | null) || []).map((a) => a.user_id))
  )
  const { data: multProfiles } =
    multUserIds.length > 0
      ? await dataClient.from("profiles").select("id, first_name, last_name, department").in("id", multUserIds)
      : { data: [] }
  const multProfileMap = new Map(((multProfiles as ProfileDepartmentRow[] | null) || []).map((p) => [p.id, p]))

  // 5. Fetch all completions
  const { data: allCompletions } =
    allTaskIds.length > 0
      ? await dataClient.from("task_user_completion").select("task_id, user_id").in("task_id", allTaskIds)
      : { data: [] }

  // Grouping logic
  const assignmentsByTask = new Map()
  allTaskAssignments?.forEach((a) => {
    if (!assignmentsByTask.has(a.task_id)) assignmentsByTask.set(a.task_id, [])
    assignmentsByTask.get(a.task_id).push(a.user_id)
  })

  const completionsByTask = new Map()
  allCompletions?.forEach((c) => {
    if (!completionsByTask.has(c.task_id)) completionsByTask.set(c.task_id, new Set())
    completionsByTask.get(c.task_id).add(c.user_id)
  })

  // 6. Reconstruct tasksWithUsers
  const tasksWithUsers = ((tasksResult.data as Task[] | null) || []).map((task) => {
    const taskData: Task = { ...task }

    if (task.assignment_type === "individual" && task.assigned_to) {
      const assignedProfile = indivProfileMap.get(task.assigned_to)
      taskData.assigned_to_user = assignedProfile
        ? {
            ...assignedProfile,
            department: assignedProfile.department || "",
          }
        : undefined
    }

    if (task.assignment_type === "multiple") {
      const userIds = assignmentsByTask.get(task.id) || []
      const taskComps = completionsByTask.get(task.id) || new Set()
      taskData.assigned_users = userIds.map((uid: string) => {
        const prof = multProfileMap.get(uid)
        return {
          ...prof,
          department: prof?.department || "",
          completed: taskComps.has(uid),
        }
      })
    }
    return taskData
  }) as Task[]

  // For leads, filter tasks strictly by their departments
  let filteredTasks = tasksWithUsers || []
  if (departmentScope) {
    filteredTasks = filteredTasks.filter((task) => {
      if (task.department && departmentScope.includes(task.department)) {
        return true
      }
      if (task.assigned_to_user?.department && departmentScope.includes(task.assigned_to_user.department)) {
        return true
      }
      if (task.assigned_users && task.assigned_users.length > 0) {
        return task.assigned_users.some((u) => u.department && departmentScope.includes(u.department))
      }
      return false
    })
  }

  // Get unique departments
  let departments: string[] = []
  if (departmentScope) {
    departments = [...departmentScope].sort()
  } else {
    departments = Array.from(
      new Set(((employeeResult.data as employee[] | null) || []).map((s) => s.department).filter(Boolean))
    ) as string[]
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
