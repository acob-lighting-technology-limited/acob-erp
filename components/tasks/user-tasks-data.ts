import { createClient } from "@/lib/supabase/client"
import type { Task, TaskUserProfile } from "@/types/task"
import { getOfficeWeekMonday } from "@/lib/meeting-week"

type TaskAssignmentRow = {
  task_id: string
  user_id: string
}

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

  const { data: assignments } = await supabase.from("task_assignments").select("task_id, user_id").eq("user_id", userId)

  const multipleTaskIds = ((assignments as TaskAssignmentRow[] | null) || []).map((a) => a.task_id)
  const { data: multipleTasks } =
    multipleTaskIds.length > 0 ? await supabase.from("tasks").select("*").in("id", multipleTaskIds) : { data: [] }

  const { data: departmentTasks } =
    userProfile?.department && userProfile?.is_department_lead
      ? await supabase
          .from("tasks")
          .select("*")
          .eq("department", userProfile.department)
          .eq("assignment_type", "department")
      : { data: [] }

  const allTasks = [...(directTasks || []), ...(multipleTasks || []), ...(departmentTasks || [])]
  const uniqueTasks = Array.from(new Map(allTasks.map((task) => [task.id, task])).values()) as Task[]
  if (uniqueTasks.length === 0) return []

  const userIds = new Set<string>()
  for (const task of uniqueTasks) {
    if (task.assigned_by) userIds.add(task.assigned_by)
    if (task.assigned_to) userIds.add(task.assigned_to)
  }

  const multiTaskIds = uniqueTasks.filter((task) => task.assignment_type === "multiple").map((task) => task.id)
  const [{ data: multiAssignments }, { data: completions }] = await Promise.all([
    multiTaskIds.length > 0
      ? supabase.from("task_assignments").select("task_id, user_id").in("task_id", multiTaskIds)
      : { data: [] },
    supabase
      .from("task_user_completion")
      .select("task_id, user_id, completed_at")
      .in(
        "task_id",
        uniqueTasks.map((task) => task.id)
      ),
  ])

  const assignmentMap = new Map<string, string[]>()
  for (const assignment of (multiAssignments as TaskAssignmentRow[] | null) || []) {
    const taskAssignments = assignmentMap.get(assignment.task_id) || []
    taskAssignments.push(assignment.user_id)
    assignmentMap.set(assignment.task_id, taskAssignments)
    userIds.add(assignment.user_id)
  }

  const { data: profiles } =
    userIds.size > 0
      ? await supabase.from("profiles").select("id, first_name, last_name, department").in("id", Array.from(userIds))
      : { data: [] }

  const profileMap = new Map(
    ((profiles as BasicProfile[] | null) || []).map((profile) => [profile.id, profile] as const)
  )
  const completionMap = new Map<string, Set<string>>()
  for (const completion of completions || []) {
    const taskCompletions = completionMap.get(completion.task_id) || new Set<string>()
    taskCompletions.add(completion.user_id)
    completionMap.set(completion.task_id, taskCompletions)
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

    if (task.assignment_type === "multiple") {
      const taskAssignments = assignmentMap.get(task.id) || []
      taskData.assigned_users = taskAssignments
        .map((assignedUserId) => profileMap.get(assignedUserId))
        .filter((profile): profile is BasicProfile => Boolean(profile))
        .map((profile) => ({
          ...profile,
          completed: completionMap.get(task.id)?.has(profile.id) || false,
        }))
      taskData.user_completed = completionMap.get(task.id)?.has(userId) || false
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

  tasksWithUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return tasksWithUsers || []
}
