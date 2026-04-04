import { createClient } from "@/lib/supabase/client"
import { dateValidation } from "@/lib/validation"
import type { TaskFormState } from "@/components/tasks/TaskFormDialog"
import type { Task } from "@/types/task"
import type { employee, UserProfile } from "./admin-tasks-content"

export type SupabaseClient = ReturnType<typeof createClient>

type TaskAssignmentRow = { user_id: string }
type ProfileRow = { id: string; first_name: string; last_name: string; department?: string | null }
type CompletionRow = { user_id: string }
type TaskAssignedUser = NonNullable<Task["assigned_users"]>[number]
type NotificationPriority = "low" | "medium" | "high" | "urgent"

export async function enrichTaskWithUsers(supabase: SupabaseClient, task: Task): Promise<Task> {
  const taskData: Task = { ...task }
  if (task.assignment_type === "individual" && task.assigned_to) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, department")
      .eq("id", task.assigned_to)
      .single()
    taskData.assigned_to_user = data || undefined
  }
  if (task.assignment_type === "multiple") {
    const { data: assignments } = await supabase.from("task_assignments").select("user_id").eq("task_id", task.id)
    if (assignments && assignments.length > 0) {
      const userIds = assignments.map((a) => (a as TaskAssignmentRow).user_id)
      const { data: userProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, department")
        .in("id", userIds)
      const { data: completions } = await supabase.from("task_user_completion").select("user_id").eq("task_id", task.id)
      const completedIds = new Set((completions as CompletionRow[] | null)?.map((c) => c.user_id) || [])
      taskData.assigned_users =
        (userProfiles as ProfileRow[] | null)?.map((profile) => ({
          ...profile,
          completed: completedIds.has(profile.id),
        })) || []
    }
  }
  return taskData
}

export function buildDepartmentLeadMap(activeEmployees: employee[]): Map<string, employee[]> {
  const map = new Map<string, employee[]>()
  for (const member of activeEmployees) {
    if (!member.is_department_lead) continue
    const depts = new Set<string>()
    if (member.department) depts.add(member.department)
    for (const d of member.lead_departments || []) {
      if (d) depts.add(d)
    }
    for (const dept of Array.from(depts)) {
      const rows = map.get(dept) || []
      rows.push(member)
      map.set(dept, rows)
    }
  }
  return map
}

export function applyTaskFilters(
  tasks: Task[],
  {
    searchQuery,
    statusFilter,
    priorityFilter,
    departmentFilter,
    employeeFilter,
    userProfile,
    scopedDepartments,
    employee,
  }: {
    searchQuery: string
    statusFilter: string
    priorityFilter: string
    departmentFilter: string
    employeeFilter: string
    userProfile: UserProfile
    scopedDepartments: string[]
    employee: employee[]
  }
): Task[] {
  return tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.work_item_number?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    let matchesDepartment = true
    if (userProfile?.is_department_lead) {
      if (scopedDepartments.length > 0) {
        matchesDepartment =
          scopedDepartments.includes(task.department || "") ||
          (task.assigned_to_user ? scopedDepartments.includes(task.assigned_to_user.department || "") : false) ||
          task.assigned_users?.some(
            (user: TaskAssignedUser) => user.department && scopedDepartments.includes(user.department)
          ) ||
          false
      }
    } else {
      matchesDepartment =
        departmentFilter === "all" ||
        task.department === departmentFilter ||
        (task.assigned_to_user
          ? employee.find((s) => s.id === task.assigned_to)?.department === departmentFilter
          : false)
    }
    const matchesEmployee =
      employeeFilter === "all" ||
      task.assigned_to === employeeFilter ||
      task.assigned_users?.some((user: TaskAssignedUser) => user.id === employeeFilter)
    return matchesSearch && matchesStatus && matchesPriority && matchesDepartment && matchesEmployee
  })
}

export function validateTaskForm(form: TaskFormState): string | null {
  if (form.assignment_type === "individual" && !form.assigned_to)
    return "Please select a employee member for individual assignment"
  if (form.assignment_type === "multiple" && form.assigned_users.length === 0)
    return "Please select at least one employee member for multiple assignment"
  if (form.assignment_type === "department" && !form.department)
    return "Please select a department for department assignment"
  if (form.task_start_date && form.task_end_date) {
    return dateValidation.validateDateRange(form.task_start_date, form.task_end_date, "task date")
  }
  return null
}

export function filterByDepartments(tasks: Task[], scopedDepartments: string[]): Task[] {
  return tasks.filter((task) => {
    if (task.department && scopedDepartments.includes(task.department)) return true
    if (task.assigned_to_user?.department && scopedDepartments.includes(task.assigned_to_user.department)) return true
    if (task.assigned_users?.some((user) => user.department && scopedDepartments.includes(user.department))) return true
    return false
  })
}

export async function persistTaskUpdate(
  supabase: SupabaseClient,
  form: TaskFormState,
  taskId: string,
  userId: string,
  taskData: Record<string, unknown>
) {
  const { error: taskError } = await supabase.from("tasks").update(taskData).eq("id", taskId)
  if (taskError) throw taskError
  if (form.assignment_type === "multiple") {
    await supabase.from("task_assignments").delete().eq("task_id", taskId)
    if (form.assigned_users.length > 0) {
      const { error } = await supabase
        .from("task_assignments")
        .insert(form.assigned_users.map((uid) => ({ task_id: taskId, user_id: uid })))
      if (error) throw error
    }
  }
  await supabase
    .from("task_updates")
    .insert({ task_id: taskId, user_id: userId, update_type: "task_updated", content: "Task details updated by admin" })
}

export async function persistTaskCreate(
  supabase: SupabaseClient,
  form: TaskFormState,
  taskData: Record<string, unknown>
) {
  const { data: newTask, error: taskError } = await supabase.from("tasks").insert(taskData).select().single()
  if (taskError) throw taskError
  if (form.assignment_type === "multiple" && form.assigned_users.length > 0) {
    const { error } = await supabase
      .from("task_assignments")
      .insert(form.assigned_users.map((uid) => ({ task_id: newTask.id, user_id: uid })))
    if (error) throw error
  }
  return newTask
}

export async function sendUpdateNotifications(form: TaskFormState, selectedTask: Task, userId: string) {
  const { notifyTaskAssigned, notifyTaskUpdated } = await import("@/lib/notifications")
  if (form.assignment_type === "individual") {
    const isNewAssignment = selectedTask.assigned_to !== form.assigned_to
    if (isNewAssignment && form.assigned_to) {
      await notifyTaskAssigned({
        userId: form.assigned_to,
        taskId: selectedTask.id,
        taskTitle: form.title,
        assignedBy: userId,
        priority: form.priority as NotificationPriority,
      })
    } else if (form.assigned_to) {
      await notifyTaskUpdated({
        userId: form.assigned_to,
        taskId: selectedTask.id,
        taskTitle: form.title,
        updatedBy: userId,
        changeDescription: "Task details updated by admin",
      })
    }
  } else if (form.assignment_type === "multiple" && form.assigned_users.length > 0) {
    await Promise.all(
      form.assigned_users.map((uid) =>
        notifyTaskUpdated({
          userId: uid,
          taskId: selectedTask.id,
          taskTitle: form.title,
          updatedBy: userId,
          changeDescription: "Task details updated by admin",
        })
      )
    )
  }
}

export async function sendCreateNotifications(form: TaskFormState, newTask: Task, userId: string) {
  const { notifyTaskAssigned } = await import("@/lib/notifications")
  if (form.assignment_type === "individual" && form.assigned_to) {
    await notifyTaskAssigned({
      userId: form.assigned_to,
      taskId: newTask.id,
      taskTitle: newTask.title,
      assignedBy: userId,
      priority: newTask.priority as NotificationPriority,
    })
  } else if (form.assignment_type === "multiple" && form.assigned_users.length > 0) {
    await Promise.all(
      form.assigned_users.map((uid) =>
        notifyTaskAssigned({
          userId: uid,
          taskId: newTask.id,
          taskTitle: newTask.title,
          assignedBy: userId,
          priority: newTask.priority as NotificationPriority,
        })
      )
    )
  }
}
