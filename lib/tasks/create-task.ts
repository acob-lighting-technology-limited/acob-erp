import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveTaskCreateAuthority } from "./create-authority"
import { taskDeadlineWindowError } from "./deadline-window"
import { getHolidaySet } from "@/lib/hr/leave-workflow"
import { addIsoDays, type HolidaySet } from "@/lib/hr/leave-days"
import { toLocalISODate } from "@/lib/utils/date"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { createNotification } from "@/lib/notifications/create"
import { sendTaskEmail } from "./mailer"
import { logger } from "@/lib/logger"
import type { TaskInput } from "./schemas"
import type { Task } from "@/types/task"

const log = logger("lib-tasks-create")

export interface CreateTaskResult {
  data: Task | null
  createdCount: number
  error?: string
  status?: number
}

/**
 * Shared server function to execute task creation with validation, audit logging,
 * and assignment notifications/emails.
 * Used by POST /api/tasks and POST /api/help-desk/tickets/[id]/convert-to-task.
 */
export async function executeCreateTask(
  supabase: SupabaseClient,
  userId: string,
  payload: TaskInput & { source_id?: string | null }
): Promise<CreateTaskResult> {
  const authority = await resolveTaskCreateAuthority(supabase, userId, payload)
  if (!authority.ok) {
    return { data: null, createdCount: 0, error: "Not authorized to create task in this department", status: 403 }
  }
  const { resolvedDepartment, targetUserIds } = authority

  if (!payload.due_date && !payload.task_end_date) {
    return { data: null, createdCount: 0, error: "Due date is required", status: 400 }
  }

  const startIso = (payload.task_start_date || toLocalISODate()).slice(0, 10)
  let holidays: HolidaySet
  try {
    holidays = await getHolidaySet(supabase, null, startIso, addIsoDays(startIso, 31))
  } catch (holidayErr) {
    log.error({ err: String(holidayErr) }, "Failed to load holidays for task deadline check")
    holidays = new Set<string>()
  }
  const windowError = taskDeadlineWindowError(
    { startIso, dueIso: payload.due_date, endIso: payload.task_end_date },
    holidays
  )
  if (windowError) {
    return { data: null, createdCount: 0, error: windowError, status: 400 }
  }

  const now = new Date().toISOString()

  if (targetUserIds.length > 1) {
    const insertPayloads = targetUserIds.map((targetId) => ({
      title: payload.title,
      description: payload.description || null,
      priority: payload.priority,
      status: payload.status,
      due_date: payload.due_date || null,
      department: resolvedDepartment,
      assignment_type: "individual" as const,
      assigned_to: targetId,
      assigned_by: userId,
      assigned_at: now,
      created_by: userId,
      updated_by: userId,
      goal_id: payload.goal_id || null,
      kpi_id: payload.kpi_id || null,
      project_id: payload.project_id || null,
      plan_id: payload.plan_id || null,
      portfolio_id: payload.portfolio_id || null,
      weight: payload.weight,
      task_start_date: payload.task_start_date || null,
      task_end_date: payload.task_end_date || null,
      source_type: payload.source_type,
      source_id: payload.source_id || null,
    }))

    const { data: createdTasks, error: tasksError } = await supabase.from("tasks").insert(insertPayloads).select("*")

    if (tasksError || !createdTasks || createdTasks.length === 0) {
      log.error({ err: tasksError }, "Failed to fan-out create tasks")
      return { data: null, createdCount: 0, error: tasksError?.message || "Failed to create tasks", status: 500 }
    }

    await writeAuditLog(
      supabase,
      {
        action: "task.bulk_create",
        entityType: "task",
        entityId: createdTasks[0].id,
        newValues: {
          title: payload.title,
          count: createdTasks.length,
          assignees: targetUserIds,
          goal_id: payload.goal_id,
        },
        context: { actorId: userId, source: "api", route: "/api/tasks" },
      },
      { failOpen: true }
    )

    for (const t of createdTasks) {
      if (t.assigned_to && t.assigned_to !== userId) {
        try {
          const notifyPriority = t.priority === "urgent" ? "urgent" : t.priority === "high" ? "high" : "normal"
          await createNotification({
            p_user_id: t.assigned_to,
            p_type: "task_assigned",
            p_category: "tasks",
            p_title: "New task assigned to you",
            p_message: t.title,
            p_priority: notifyPriority,
            p_link_url: "/tasks/management",
            p_actor_id: userId,
            p_entity_type: "task",
            p_entity_id: t.id,
          })
        } catch (notifyErr) {
          log.error({ err: String(notifyErr), targetId: t.assigned_to }, "Task assignment notification failed")
        }
      }
    }

    for (const t of createdTasks) {
      if (t.assigned_to && t.assigned_to !== userId) {
        try {
          await sendTaskEmail(supabase, {
            kind: "assigned",
            taskId: t.id,
            recipientIds: [t.assigned_to as string],
            replyToUserId: userId,
          })
        } catch (err) {
          log.error({ err: String(err) }, "Failed to send task email")
        }
      }
    }

    return { data: createdTasks[0] as unknown as Task, createdCount: createdTasks.length }
  }

  const primaryAssignee = targetUserIds.length === 1 ? targetUserIds[0] : null
  const insertPayload = {
    title: payload.title,
    description: payload.description || null,
    priority: payload.priority,
    status: payload.status,
    due_date: payload.due_date || null,
    department: resolvedDepartment,
    assignment_type: "individual" as const,
    assigned_to: primaryAssignee,
    assigned_by: userId,
    assigned_at: primaryAssignee ? now : null,
    created_by: userId,
    updated_by: userId,
    goal_id: payload.goal_id || null,
    kpi_id: payload.kpi_id || null,
    project_id: payload.project_id || null,
    plan_id: payload.plan_id || null,
    portfolio_id: payload.portfolio_id || null,
    weight: payload.weight,
    task_start_date: payload.task_start_date || null,
    task_end_date: payload.task_end_date || null,
    source_type: payload.source_type,
    source_id: payload.source_id || null,
  }

  const { data: task, error: taskError } = await supabase.from("tasks").insert(insertPayload).select("*").single()

  if (taskError || !task) {
    log.error({ err: taskError }, "Failed to insert task")
    return { data: null, createdCount: 0, error: taskError?.message || "Failed to create task", status: 500 }
  }

  await writeAuditLog(
    supabase,
    {
      action: "task.create",
      entityType: "task",
      entityId: task.id,
      newValues: {
        title: task.title,
        status: task.status,
        goal_id: task.goal_id,
        assignment_type: task.assignment_type,
        assigned_to: task.assigned_to,
      },
      context: { actorId: userId, source: "api", route: "/api/tasks" },
    },
    { failOpen: true }
  )

  if (task.assigned_to && task.assigned_to !== userId) {
    try {
      const notifyPriority = task.priority === "urgent" ? "urgent" : task.priority === "high" ? "high" : "normal"
      await createNotification({
        p_user_id: task.assigned_to,
        p_type: "task_assigned",
        p_category: "tasks",
        p_title: "New task assigned to you",
        p_message: task.title,
        p_priority: notifyPriority,
        p_link_url: "/tasks/management",
        p_actor_id: userId,
        p_entity_type: "task",
        p_entity_id: task.id,
      })
    } catch (notifyErr) {
      log.error({ err: String(notifyErr), targetId: task.assigned_to }, "Task assignment notification failed")
    }

    try {
      await sendTaskEmail(supabase, {
        kind: "assigned",
        taskId: task.id,
        recipientIds: [task.assigned_to],
        replyToUserId: userId,
      })
    } catch (mailErr) {
      log.error({ err: String(mailErr) }, "Failed to send task email")
    }
  }

  return { data: task as unknown as Task, createdCount: 1 }
}
