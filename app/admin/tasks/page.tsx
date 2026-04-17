import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import {
  expandDepartmentScopeForQuery,
  getDepartmentScope,
  normalizeDepartmentName,
  resolveAdminScope,
} from "@/lib/admin/rbac"
import { AdminTasksContent, type employee, type UserProfile } from "./management/admin-tasks-content"
import type { Task } from "@/types/task"
import { listAssignableProfiles } from "@/lib/workforce/assignment-policy"
import { hasGlobalTaskAssignmentAuthority } from "@/lib/tasks/assignment-scope"

import { logger } from "@/lib/logger"

const log = logger("tasks")

type ProfileDepartmentRow = {
  id: string
  first_name: string
  last_name: string
  department: string | null
}

type GoalFilterOption = {
  id: string
  title: string
}

type GoalRow = {
  id: string
  title: string
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
  const canAssignGlobally = hasGlobalTaskAssignmentAuthority({
    id: user.id,
    department: scope.department,
    is_department_lead: scope.isDepartmentLead,
    lead_departments: scope.leadDepartments,
  })
  const departmentScope =
    scope.scopeMode === "lead"
      ? getDepartmentScope(scope, "general")
      : canAssignGlobally
        ? null
        : getDepartmentScope(scope, "general")
  const queryDepartmentScope = departmentScope ? expandDepartmentScopeForQuery(departmentScope) : null

  const userProfile: UserProfile = {
    id: user.id,
    role: scope.role,
    department: scope.department,
    is_department_lead: scope.isDepartmentLead,
    lead_departments: scope.leadDepartments,
    managed_departments: scope.managedDepartments,
    is_global_task_assigner: scope.scopeMode === "lead" ? false : canAssignGlobally,
  }

  // Build query based on role - exclude weekly action point items
  const tasksQuery = dataClient
    .from("tasks")
    .select("*")
    .neq("category", "weekly_action")
    .order("created_at", { ascending: false })

  // Fetch employee - leads can only see employee in their departments
  const [tasksResult, employeeResult] = await Promise.all([
    tasksQuery,
    listAssignableProfiles(dataClient, {
      select:
        "id, first_name, last_name, company_email, department, employment_status, is_department_lead, lead_departments",
      departmentScope: queryDepartmentScope,
      allowLegacyNullStatus: true,
    }),
  ])

  if (tasksResult.error || employeeResult.error) {
    log.error("Error loading data:", tasksResult.error || employeeResult.error)
    return { tasks: [], employee: [], departments: [], userProfile }
  }

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
  const taskGoalIds = Array.from(
    new Set((((tasksResult.data as Task[] | null) || []).map((task) => task.goal_id).filter(Boolean) as string[]) || [])
  )
  const { data: taskGoalRows } =
    taskGoalIds.length > 0
      ? await dataClient.from("goals_objectives").select("id, title").in("id", taskGoalIds)
      : { data: [] as GoalRow[] }
  const taskGoalMap = new Map(((taskGoalRows as GoalRow[] | null) || []).map((goal) => [goal.id, goal.title]))

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
    taskData.goal_title = task.goal_id ? taskGoalMap.get(task.goal_id) || null : null

    return taskData
  }) as Task[]

  // For leads, filter tasks strictly by their departments
  let filteredTasks = (tasksWithUsers || []).filter((task) => String(task.source_type || "") !== "action_item")
  if (departmentScope) {
    const scopedDepartmentTokens = new Set(
      departmentScope.map((departmentName) => normalizeDepartmentName(departmentName))
    )
    filteredTasks = filteredTasks.filter((task) => {
      if (task.department && scopedDepartmentTokens.has(normalizeDepartmentName(task.department))) {
        return true
      }
      if (
        task.assigned_to_user?.department &&
        scopedDepartmentTokens.has(normalizeDepartmentName(task.assigned_to_user.department))
      ) {
        return true
      }
      if (task.assignment_type === "individual" && task.assigned_to === user.id) {
        return true
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

  let goalsQuery = dataClient.from("goals_objectives").select("id, title, department, approval_status")
  if (departmentScope && departmentScope.length > 0) {
    goalsQuery = goalsQuery.in("department", departmentScope)
  }
  const { data: goalRowsRaw } = await goalsQuery.order("title", { ascending: true })
  const goalRows = (goalRowsRaw || [])
    .filter((goal) => {
      const approvalStatus = String(goal.approval_status || "").toLowerCase()
      return approvalStatus === "approved"
    })
    .map((goal) => ({ id: goal.id, title: goal.title })) as GoalFilterOption[]

  return {
    tasks: filteredTasks as Task[],
    employee: (employeeResult.data || []) as employee[],
    departments,
    goals: (goalRows || []) as GoalFilterOption[],
    userProfile,
  }
}

export default async function AdminTasksPage({ searchParams }: { searchParams?: { goal_id?: string } }) {
  const data = await getAdminTasksData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    tasks: Task[]
    employee: employee[]
    departments: string[]
    goals: GoalFilterOption[]
    userProfile: UserProfile
  }

  return (
    <AdminTasksContent
      initialTasks={pageData.tasks}
      initialemployee={pageData.employee}
      initialDepartments={pageData.departments}
      initialGoals={pageData.goals}
      userProfile={pageData.userProfile}
      initialGoalId={searchParams?.goal_id || ""}
    />
  )
}
