import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TasksContent } from "./tasks-content"

export interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  due_date?: string
  started_at?: string
  completed_at?: string
  created_at: string
  assignment_type?: "individual" | "multiple" | "department"
  assigned_by?: string
  assigned_by_user?: {
    first_name: string
    last_name: string
  }
  department?: string
  assigned_users?: Array<{
    id: string
    first_name: string
    last_name: string
    completed?: boolean
  }>
  user_completed?: boolean
  can_change_status?: boolean
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

  // Fetch assigned_by user details and additional info
  const tasksWithUsers = await Promise.all(
    (uniqueTasks || []).map(async (task: any) => {
      const taskData: any = { ...task }

      // Fetch assigned_by user
      if (task.assigned_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", task.assigned_by)
          .single()

        taskData.assigned_by_user = profile
      }

      // For multiple-user tasks, fetch all assigned users and completion status
      if (task.assignment_type === "multiple") {
        const { data: taskAssignments } = await supabase
          .from("task_assignments")
          .select("user_id")
          .eq("task_id", task.id)

        if (taskAssignments && taskAssignments.length > 0) {
          const userIds = taskAssignments.map((a: any) => a.user_id)
          const { data: userProfiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", userIds)

          // Check if current user has completed
          const { data: userCompletion } = await supabase
            .from("task_user_completion")
            .select("user_id")
            .eq("task_id", task.id)
            .eq("user_id", user.id)
            .single()

          const completedUserIds = new Set(
            (await supabase.from("task_user_completion").select("user_id").eq("task_id", task.id)).data?.map(
              (c: any) => c.user_id
            ) || []
          )

          taskData.assigned_users =
            userProfiles?.map((profile: any) => ({
              ...profile,
              completed: completedUserIds.has(profile.id),
            })) || []
          taskData.user_completed = !!userCompletion
        }
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
