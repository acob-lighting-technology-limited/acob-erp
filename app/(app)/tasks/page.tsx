import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TasksContent } from "./management/tasks-content"
import type { Task } from "@/types/task"

type UserProfile = {
  department: string | null
  role: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
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
    .neq("category", "weekly_action")

  const { data: departmentTasks } = userProfile?.department
    ? await supabase
        .from("tasks")
        .select("*")
        .eq("department", userProfile.department)
        .eq("assignment_type", "department")
        .neq("source_type", "help_desk")
    : { data: [] }

  const allTasks = [...(individualTasks || []), ...(departmentTasks || [])].filter(
    (task) => String(task.source_type || "") !== "action_item"
  )
  const uniqueTasks = Array.from(new Map(allTasks.map((t) => [t.id, t])).values()) as Task[]

  const assignedByIds = Array.from(new Set(uniqueTasks.map((t) => t.assigned_by).filter(Boolean))) as string[]
  const taskIds = uniqueTasks.map((t) => t.id)
  const goalIds = Array.from(new Set(uniqueTasks.map((t) => t.goal_id).filter(Boolean))) as string[]

  const { data: assignedByProfiles } =
    assignedByIds.length > 0
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", assignedByIds)
      : { data: [] }
  const assignedByMap = new Map(((assignedByProfiles as ProfileNameRow[] | null) || []).map((p) => [p.id, p]))

  const { data: taskComments } =
    taskIds.length > 0
      ? await supabase.from("task_updates").select("task_id").in("task_id", taskIds).eq("update_type", "comment")
      : { data: [] }

  const { data: goalsData } =
    goalIds.length > 0
      ? await supabase.from("goals_objectives").select("id, title").in("id", goalIds)
      : { data: [] as Array<{ id: string; title: string }> }
  const goalTitleById = new Map(
    ((goalsData as Array<{ id: string; title: string }> | null) || []).map((goal) => [goal.id, goal.title])
  )
  const commentCountMap = new Map<string, number>()
  for (const row of taskComments || []) {
    const taskId = String((row as { task_id?: string | null }).task_id || "")
    if (!taskId) continue
    commentCountMap.set(taskId, (commentCountMap.get(taskId) || 0) + 1)
  }

  const tasksWithUsers: Task[] = await Promise.all(
    uniqueTasks.map(async (task) => {
      const taskData: Task = { ...task }
      taskData.comment_count = commentCountMap.get(task.id) || 0

      if (task.assigned_by) {
        taskData.assigned_by_user = assignedByMap.get(task.assigned_by)
      }
      taskData.goal_title = task.goal_id ? goalTitleById.get(task.goal_id) || null : null

      if (task.assignment_type === "department") {
        taskData.can_change_status = false
      }

      return taskData
    })
  )

  tasksWithUsers.sort((a: Task, b: Task) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

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
    userProfile: UserProfile | null
  }

  return <TasksContent initialTasks={tasksData.tasks} userId={tasksData.userId} userProfile={tasksData.userProfile} />
}
