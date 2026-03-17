import { createClient } from "@/lib/supabase/client"
import type { Task } from "@/app/(app)/dashboard/tasks/management/tasks-content"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadUserTasks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userProfile: any
): Promise<Task[]> {
  const { data: individualTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .eq("assignment_type", "individual")

  const { data: assignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", userId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const multipleTaskIds = assignments?.map((a: any) => a.task_id) || []
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniqueTasks = Array.from(new Map(allTasks.map((t: any) => [t.id, t])).values())

  const tasksWithUsers = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (uniqueTasks || []).map(async (task: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taskData: any = { ...task }

      if (task.assigned_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", task.assigned_by)
          .single()

        taskData.assigned_by_user = profile
      }

      if (task.assignment_type === "multiple") {
        const { data: taskAssignments } = await supabase
          .from("task_assignments")
          .select("user_id")
          .eq("task_id", task.id)

        if (taskAssignments && taskAssignments.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const userIds = taskAssignments.map((a: any) => a.user_id)
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
            (await supabase.from("task_user_completion").select("user_id").eq("task_id", task.id)).data?.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (c: any) => c.user_id
            ) || []
          )

          taskData.assigned_users =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            userProfiles?.map((profile: any) => ({
              ...profile,
              completed: completedUserIds.has(profile.id),
            })) || []
          taskData.user_completed = !!userCompletion
        }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasksWithUsers.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (tasksWithUsers as Task[]) || []
}
