import type { SupabaseClient as GenericSupabaseClient } from "@supabase/supabase-js"
import { dateValidation } from "@/lib/validation"
import type { TaskFormState } from "@/components/tasks/TaskFormDialog"
import type { Task } from "@/types/task"
import type { employee, UserProfile } from "./admin-tasks-content"

export type SupabaseClient = GenericSupabaseClient

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
  return taskData
}

export function applyTaskFilters(
  tasks: Task[],
  {
    searchQuery,
    statusFilter,
    priorityFilter,
    departmentFilter,
    employeeFilter,
    goalFilter,
    userProfile,
    scopedDepartments,
    employee,
  }: {
    searchQuery: string
    statusFilter: string
    priorityFilter: string
    departmentFilter: string
    employeeFilter: string
    goalFilter: string
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
    const matchesEmployee = employeeFilter === "all" || task.assigned_to === employeeFilter
    const matchesGoal = goalFilter === "all" || task.goal_id === goalFilter
    return matchesSearch && matchesStatus && matchesPriority && matchesDepartment && matchesEmployee && matchesGoal
  })
}

export function validateTaskForm(form: TaskFormState): string | null {
  if (!form.title.trim()) return "Please enter a task title"
  if (!form.kpi_id?.trim()) return "Please select a Corporate KPI for this task"
  const hasAssignee = form.assigned_to || (form.assigned_users && form.assigned_users.length > 0)
  if (!hasAssignee) {
    return "Please select at least one assignee for this task"
  }
  if (form.task_start_date && form.task_end_date) {
    return dateValidation.validateDateRange(form.task_start_date, form.task_end_date, "task date")
  }
  return null
}

export function filterByDepartments(tasks: Task[], scopedDepartments: string[]): Task[] {
  return tasks.filter((task) => {
    if (task.department && scopedDepartments.includes(task.department)) return true
    if (task.assigned_to_user?.department && scopedDepartments.includes(task.assigned_to_user.department)) return true
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
  await supabase
    .from("task_updates")
    .insert({ task_id: taskId, user_id: userId, update_type: "task_updated", content: "Task details updated by admin" })
}

export async function persistTaskCreate(
  supabase: SupabaseClient,
  _form: TaskFormState,
  taskData: Record<string, unknown>
) {
  const { data: newTask, error: taskError } = await supabase.from("tasks").insert(taskData).select().single()
  if (taskError) throw taskError
  return newTask
}
