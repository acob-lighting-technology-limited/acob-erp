import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TasksContent, type Task } from "./management/tasks-content"

async function getTasksData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get user profile to check department and role
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("department, role, lead_departments")
    .eq("id", user.id)
    .single()

  // Load tasks assigned to user individually
  const { data: individualTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", user.id)
    .eq("assignment_type", "individual")

  // Load tasks where user is in task_assignments (multiple-user tasks)
  const { data: assignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", user.id)

  const multipleTaskIds = assignments?.map((a: any) => a.task_id) || []
  const { data: multipleTasks } =
    multipleTaskIds.length > 0
      ? await supabase.from("tasks").select("*").in("id", multipleTaskIds).eq("assignment_type", "multiple")
      : { data: [] }

  // Load department tasks if user has a department
  const { data: departmentTasks } = userProfile?.department
    ? await supabase
        .from("tasks")
        .select("*")
        .eq("department", userProfile.department)
        .eq("assignment_type", "department")
    : { data: [] }

  // Combine all tasks and remove duplicates
  const allTasks = [...(individualTasks || []), ...(multipleTasks || []), ...(departmentTasks || [])]
  const uniqueTasks = Array.from(new Map(allTasks.map((t: any) => [t.id, t])).values())

  // 1. Collect all IDs for batch queries
  const allTaskIds = uniqueTasks.map((t: any) => t.id)
  const assignedByIds = Array.from(new Set(uniqueTasks.map((t: any) => t.assigned_by).filter(Boolean))) as string[]

  // 2. Fetch assigned_by profiles
  const { data: assignedByProfiles } =
    assignedByIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", assignedByIds)
      : { data: [] }
  const assignedByMap = new Map(assignedByProfiles?.map((p: any) => [p.id, p]))

  // 3. Fetch task assignments for multiple tasks
  const multipleTasksOnly = uniqueTasks.filter((t: any) => t.assignment_type === "multiple")
  const taskIdsForMultipleType = multipleTasksOnly.map((t: any) => t.id)

  const { data: allAssignments } =
    taskIdsForMultipleType.length > 0
      ? await supabase.from("task_assignments").select("task_id, user_id").in("task_id", taskIdsForMultipleType)
      : { data: [] }

  // 4. Fetch profiles for assigned users
  const assignedUserIds = Array.from(new Set(allAssignments?.map((a: any) => a.user_id) || []))
  const { data: assignedUserProfiles } =
    assignedUserIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", assignedUserIds)
      : { data: [] }
  const userProfileMap = new Map(assignedUserProfiles?.map((p: any) => [p.id, p]))

  // 5. Fetch all completions for these tasks
  const { data: allCompletions } =
    allTaskIds.length > 0
      ? await supabase.from("task_user_completion").select("task_id, user_id").in("task_id", allTaskIds)
      : { data: [] }

  // Grouping logic
  const assignmentsByTask = new Map()
  allAssignments?.forEach((a: any) => {
    if (!assignmentsByTask.has(a.task_id)) assignmentsByTask.set(a.task_id, [])
    assignmentsByTask.get(a.task_id).push(a.user_id)
  })

  const completionsByTask = new Map()
  allCompletions?.forEach((c: any) => {
    if (!completionsByTask.has(c.task_id)) completionsByTask.set(c.task_id, new Set())
    completionsByTask.get(c.task_id).add(c.user_id)
  })

  // 6. Assemble tasksWithUsers
  const tasksWithUsers = await Promise.all(
    (uniqueTasks || []).map(async (task: any) => {
      const taskData: any = { ...task }

      // Attach assigned_by
      if (task.assigned_by) {
        taskData.assigned_by_user = assignedByMap.get(task.assigned_by)
      }

      // For multiple-user tasks, fetch all assigned users and completion status
      if (task.assignment_type === "multiple") {
        const userIds = assignmentsByTask.get(task.id) || []
        const taskCompletions = completionsByTask.get(task.id) || new Set()

        taskData.assigned_users = userIds.map((uid: string) => {
          const profile = userProfileMap.get(uid)
          return {
            ...profile,
            completed: taskCompletions.has(uid),
          }
        })
        taskData.user_completed = taskCompletions.has(user.id)
      }

      // For department tasks, check if user can change status
      if (task.assignment_type === "department") {
        const canChangeStatus =
          userProfile?.role === "admin" ||
          userProfile?.role === "super_admin" ||
          (userProfile?.role === "lead" && userProfile?.lead_departments?.includes(task.department))
        taskData.can_change_status = canChangeStatus
      }

      return taskData
    })
  )

  // Sort by created_at
  tasksWithUsers.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    tasks: tasksWithUsers as Task[],
    userId: user.id,
    userProfile: userProfile || null,
  }
}

export default async function TasksPage() {
  const data = await getTasksData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const tasksData = data as {
    tasks: Task[]
    userId: string
    userProfile: any
  }

  return <TasksContent initialTasks={tasksData.tasks} userId={tasksData.userId} userProfile={tasksData.userProfile} />
}
