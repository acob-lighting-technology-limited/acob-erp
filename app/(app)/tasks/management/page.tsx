import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TasksContent, type Task, type TaskUserProfile } from "./tasks-content"

type UserProfile = TaskUserProfile

type TaskAssignmentRow = {
  task_id: string
  user_id: string
}

type ProfileNameRow = {
  id: string
  first_name: string
  last_name: string
}

async function getTasksData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("department, role, is_department_lead, lead_departments")
    .eq("id", user.id)
    .single()

  const { data: individualTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", user.id)
    .eq("assignment_type", "individual")

  const { data: assignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", user.id)

  const multipleTaskIds = ((assignments as TaskAssignmentRow[] | null) || []).map((a) => a.task_id)
  const { data: multipleTasks } =
    multipleTaskIds.length > 0
      ? await supabase.from("tasks").select("*").in("id", multipleTaskIds).eq("assignment_type", "multiple")
      : { data: [] }

  const { data: departmentTasks } = userProfile?.department
    ? await supabase
        .from("tasks")
        .select("*")
        .eq("department", userProfile.department)
        .eq("assignment_type", "department")
    : { data: [] }

  const allTasks = [...(individualTasks || []), ...(multipleTasks || []), ...(departmentTasks || [])]
  const uniqueTasks = Array.from(new Map(allTasks.map((t) => [t.id, t])).values()) as Task[]

  const allTaskIds = uniqueTasks.map((t) => t.id)
  const assignedByIds = Array.from(new Set(uniqueTasks.map((t) => t.assigned_by).filter(Boolean))) as string[]

  const { data: assignedByProfiles } =
    assignedByIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", assignedByIds)
      : { data: [] }
  const assignedByMap = new Map(((assignedByProfiles as ProfileNameRow[] | null) || []).map((p) => [p.id, p]))

  const multipleTasksOnly = uniqueTasks.filter((t) => t.assignment_type === "multiple")
  const taskIdsForMultipleType = multipleTasksOnly.map((t) => t.id)

  const { data: allAssignments } =
    taskIdsForMultipleType.length > 0
      ? await supabase.from("task_assignments").select("task_id, user_id").in("task_id", taskIdsForMultipleType)
      : { data: [] }

  const assignedUserIds = Array.from(
    new Set(((allAssignments as TaskAssignmentRow[] | null) || []).map((a) => a.user_id))
  )
  const { data: assignedUserProfiles } =
    assignedUserIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", assignedUserIds)
      : { data: [] }
  const userProfileMap = new Map(((assignedUserProfiles as ProfileNameRow[] | null) || []).map((p) => [p.id, p]))

  const { data: allCompletions } =
    allTaskIds.length > 0
      ? await supabase.from("task_user_completion").select("task_id, user_id").in("task_id", allTaskIds)
      : { data: [] }

  const assignmentsByTask = new Map()
  allAssignments?.forEach((a) => {
    if (!assignmentsByTask.has(a.task_id)) assignmentsByTask.set(a.task_id, [])
    assignmentsByTask.get(a.task_id).push(a.user_id)
  })

  const completionsByTask = new Map()
  allCompletions?.forEach((c) => {
    if (!completionsByTask.has(c.task_id)) completionsByTask.set(c.task_id, new Set())
    completionsByTask.get(c.task_id).add(c.user_id)
  })

  const tasksWithUsers = await Promise.all(
    uniqueTasks.map(async (task) => {
      const taskData: Task = { ...task }

      if (task.assigned_by) {
        taskData.assigned_by_user = assignedByMap.get(task.assigned_by)
      }

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

      if (task.assignment_type === "department") {
        const canChangeStatus =
          userProfile?.role === "admin" ||
          ["developer", "super_admin"].includes(userProfile?.role || "") ||
          (userProfile?.is_department_lead && userProfile?.lead_departments?.includes(task.department))
        taskData.can_change_status = canChangeStatus
      }

      return taskData
    })
  )

  tasksWithUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    tasks: tasksWithUsers as Task[],
    userId: user.id,
    userProfile: userProfile || null,
  }
}

export default async function TasksManagementPage() {
  const data = await getTasksData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const tasksData = data as {
    tasks: Task[]
    userId: string
    userProfile: UserProfile | null
  }

  return <TasksContent initialTasks={tasksData.tasks} userId={tasksData.userId} userProfile={tasksData.userProfile} />
}
