import { createClient } from "@/lib/supabase/client"
import type { Task, TaskUserProfile } from "@/app/(app)/tasks/management/tasks-content"

type TaskAssignmentRow = {
  task_id: string
  user_id: string
}

type BasicProfile = {
  id: string
  first_name: string
  last_name: string
}

export async function loadUserTasks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userProfile: TaskUserProfile | null
): Promise<Task[]> {
  const { data: individualTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .eq("assignment_type", "individual")

  const { data: assignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", userId)

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

  const tasksWithUsers = await Promise.all(
    uniqueTasks.map(async (task) => {
      const taskData: Task = { ...task }

      if (task.assigned_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", task.assigned_by)
          .single()

        taskData.assigned_by_user = profile || undefined
      }

      if (task.assignment_type === "multiple") {
        const { data: taskAssignments } = await supabase
          .from("task_assignments")
          .select("user_id")
          .eq("task_id", task.id)

        if (taskAssignments && taskAssignments.length > 0) {
          const userIds = (taskAssignments as TaskAssignmentRow[]).map((a) => a.user_id)
          const { data: userProfiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", userIds)

          const { data: userCompletion } = await supabase
            .from("task_user_completion")
            .select("user_id")
            .eq("task_id", task.id)
            .eq("user_id", userId)
            .single()

          const completedUserIds = new Set(
            (
              ((await supabase.from("task_user_completion").select("user_id").eq("task_id", task.id)).data as Array<{
                user_id: string
              }> | null) || []
            ).map((c) => c.user_id)
          )

          taskData.assigned_users = ((userProfiles as BasicProfile[] | null) || []).map((profile) => ({
            ...profile,
            completed: completedUserIds.has(profile.id),
          }))
          taskData.user_completed = !!userCompletion
        }
      }

      if (task.assignment_type === "department") {
        const canChangeStatus =
          userProfile?.role === "admin" ||
          ["developer", "super_admin"].includes(userProfile?.role || "") ||
          (userProfile?.is_department_lead && task.department
            ? userProfile?.lead_departments?.includes(task.department)
            : false)
        taskData.can_change_status = canChangeStatus
      }

      return taskData
    })
  )

  tasksWithUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return tasksWithUsers || []
}
