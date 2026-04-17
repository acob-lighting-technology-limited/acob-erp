import { createClient } from "@/lib/supabase/client"
import type { Task, TaskUserProfile } from "@/types/task"
import { getOfficeWeekMonday } from "@/lib/meeting-week"

type BasicProfile = {
  id: string
  first_name: string
  last_name: string
  department?: string | null
}

type ActionItemDueDateRow = {
  id: string
  due_date?: string | null
  week_number: number
  year: number
}

function toLocalDueDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function resolveActionItemDueDate(actionItem?: ActionItemDueDateRow | null) {
  if (!actionItem) return undefined
  if (actionItem.due_date) return actionItem.due_date

  const sunday = getOfficeWeekMonday(actionItem.week_number, actionItem.year)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 0, 0)
  return toLocalDueDateString(sunday)
}

export async function loadUserTasks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userProfile: TaskUserProfile | null
): Promise<Task[]> {
  const { data: directTasks } = await supabase
    .from("tasks")
    .select("*")
    .or(`assigned_to.eq.${userId},assigned_by.eq.${userId}`)
    .neq("category", "weekly_action")
    .order("created_at", { ascending: false })

  const { data: departmentTasks } =
    userProfile?.department && userProfile?.is_department_lead
      ? await supabase
          .from("tasks")
          .select("*")
          .eq("department", userProfile.department)
          .eq("assignment_type", "department")
          .neq("source_type", "help_desk")
      : { data: [] }

  const allTasks = [...(directTasks || []), ...(departmentTasks || [])].filter(
    (task) => String(task.source_type || "") !== "action_item"
  )
  const uniqueTasks = Array.from(new Map(allTasks.map((task) => [task.id, task])).values()) as Task[]
  if (uniqueTasks.length === 0) return []
  const taskIds = uniqueTasks.map((task) => task.id)

  const userIds = new Set<string>()
  for (const task of uniqueTasks) {
    if (task.assigned_by) userIds.add(task.assigned_by)
    if (task.assigned_to) userIds.add(task.assigned_to)
  }

  const { data: profiles } =
    userIds.size > 0
      ? await supabase.from("profiles").select("id, first_name, last_name, department").in("id", Array.from(userIds))
      : { data: [] }

  const profileMap = new Map(
    ((profiles as BasicProfile[] | null) || []).map((profile) => [profile.id, profile] as const)
  )

  const { data: taskComments } =
    taskIds.length > 0
      ? await supabase.from("task_updates").select("task_id").in("task_id", taskIds).eq("update_type", "comment")
      : { data: [] }
  const commentCountMap = new Map<string, number>()
  for (const row of taskComments || []) {
    const taskId = String((row as { task_id?: string | null }).task_id || "")
    if (!taskId) continue
    commentCountMap.set(taskId, (commentCountMap.get(taskId) || 0) + 1)
  }

  const actionItemIds = uniqueTasks
    .filter((task) => task.source_type === "action_item" && task.source_id)
    .map((task) => String(task.source_id))

  const { data: actionItems } =
    actionItemIds.length > 0
      ? await supabase.from("action_items").select("id, due_date, week_number, year").in("id", actionItemIds)
      : { data: [] }

  const actionItemDueDateMap = new Map(
    ((actionItems as ActionItemDueDateRow[] | null) || []).map((item) => [item.id, item] as const)
  )

  const tasksWithUsers = uniqueTasks.map((task) => {
    const taskData: Task = { ...task }
    taskData.comment_count = commentCountMap.get(task.id) || 0

    if (task.source_type === "action_item" && task.source_id) {
      taskData.due_date = resolveActionItemDueDate(actionItemDueDateMap.get(String(task.source_id))) || task.due_date
    }

    if (task.assigned_by) {
      const profile = profileMap.get(task.assigned_by)
      if (profile) {
        taskData.assigned_by_user = {
          first_name: profile.first_name,
          last_name: profile.last_name,
          department: profile.department,
        }
      }
    }

    if (task.assigned_to) {
      const profile = profileMap.get(task.assigned_to)
      if (profile) {
        taskData.assigned_to_user = profile
      }
    }

    if (task.assignment_type === "department") {
      taskData.can_change_status = false
    }

    return taskData
  })

  tasksWithUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return tasksWithUsers || []
}
