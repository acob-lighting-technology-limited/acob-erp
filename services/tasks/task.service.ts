import { BaseService } from "../base.service"

export interface TaskFields {
  id?: string
  title: string
  description?: string
  priority: "low" | "normal" | "high" | "urgent"
  status: "pending" | "in_progress" | "completed" | "cancelled"
  assigned_to?: string
  assigned_by?: string
  department?: string
  due_date?: string
  project_id?: string
  task_start_date?: string
  time_estimate?: string
  assignment_type?: "individual" | "multiple" | "department"
  created_at?: string
  updated_at?: string
}

/**
 * Service for managing tasks.
 */
export class TaskService extends BaseService {
  constructor() {
    super("tasks")
  }

  /**
   * Get all tasks with user and project details
   */
  async getAllWithDetails(filters?: { department?: string; status?: string }) {
    const supabase = await this.getClient()

    let query = supabase.from(this.tableName).select("*").order("created_at", { ascending: false })

    if (filters?.department) {
      query = query.eq("department", filters.department)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    const { data, error } = await query
    if (error) throw error

    // Fetch user details for assigned tasks
    const tasksWithUsers = await Promise.all(
      (data || []).map(async (task: any) => {
        const taskData: any = { ...task }

        if (task.assignment_type === "individual" && task.assigned_to) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, department")
            .eq("id", task.assigned_to)
            .single()

          taskData.assigned_to_user = profile
        }

        if (task.assignment_type === "multiple") {
          const { data: assignments } = await supabase.from("task_assignments").select("user_id").eq("task_id", task.id)

          if (assignments && assignments.length > 0) {
            const userIds = assignments.map((a: any) => a.user_id)
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, first_name, last_name")
              .in("id", userIds)

            taskData.assigned_users = profiles || []
          }
        }

        return taskData
      })
    )

    return tasksWithUsers
  }

  /**
   * Get tasks assigned to a specific user
   */
  async getByAssignedUser(userId: string) {
    const supabase = await this.getClient()

    // Individual tasks
    const { data: individual } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("assigned_to", userId)
      .eq("assignment_type", "individual")

    // Multiple-user tasks through assignments
    const { data: assignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", userId)

    const multipleTaskIds = assignments?.map((a: any) => a.task_id) || []
    const { data: multiple } =
      multipleTaskIds.length > 0
        ? await supabase.from(this.tableName).select("*").in("id", multipleTaskIds).eq("assignment_type", "multiple")
        : { data: [] }

    // Combine and deduplicate
    const allTasks = [...(individual || []), ...(multiple || [])]
    return Array.from(new Map(allTasks.map((t: any) => [t.id, t])).values())
  }

  /**
   * Get task statistics
   */
  async getStats() {
    const supabase = await this.getClient()

    const [{ count: total }, { count: pending }, { count: inProgress }, { count: completed }, { count: urgent }] =
      await Promise.all([
        supabase.from(this.tableName).select("*", { count: "exact", head: true }),
        supabase.from(this.tableName).select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from(this.tableName).select("*", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from(this.tableName).select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from(this.tableName).select("*", { count: "exact", head: true }).eq("priority", "urgent"),
      ])

    return {
      total: total || 0,
      pending: pending || 0,
      inProgress: inProgress || 0,
      completed: completed || 0,
      urgent: urgent || 0,
    }
  }
}

export const taskService = new TaskService()
