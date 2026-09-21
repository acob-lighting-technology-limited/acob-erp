import { NextRequest, NextResponse, after } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { checkRequestSize } from "@/lib/api/request-size"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getRequestScope, type AdminScope } from "@/lib/admin/api-scope"
import { canAssignToDepartment, canAssignToProfile } from "@/lib/tasks/assignment-scope"
import { TASK_WEIGHT_MAX, TASK_WEIGHT_MIN } from "@/lib/tasks/scoring"
import { sendTaskEmail } from "@/lib/tasks/mailer"

const log = logger("task-detail-route")

// assignment_type is deliberately absent too. It is a creation-time choice
// between "one person" and "several", and "several" only ever meant "make one
// task each". Every stored row belongs to exactly one person, so letting the
// edit form post "multiple" back could only mislabel the row.
//
// status is deliberately absent: this route used to accept it and spread it
// straight into the update with no rating check and no reviewer-role check,
// which meant the edit form's status dropdown could send a task to
// "completed" with no rating at all — silently reopening the exact hole the
// mandatory-rating rule exists to close. Every status change now goes through
// /api/tasks/[id]/status, which enforces both.
const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: z.string().trim().min(1).optional(),
  due_date: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  goal_id: z.string().uuid().optional().nullable(),
  kpi_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  plan_id: z.string().uuid().optional().nullable(),
  weight: z.number().int().min(TASK_WEIGHT_MIN).max(TASK_WEIGHT_MAX).optional(),
  task_start_date: z.string().optional().nullable(),
  task_end_date: z.string().optional().nullable(),
  extension_reason: z.string().trim().max(5000).optional().nullable(),
  is_archived: z.boolean().optional(),
})

type ProfileRecord = {
  id: string
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

/** A date column, an ISO timestamp and the form's "YYYY-MM-DD" all mean the same day. */
function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 10)
}

function isAdminProfile(scope: AdminScope | null) {
  return scope?.isAdminLike === true && scope.scopeMode !== "lead"
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

    const { data: task, error } = await supabase.from("tasks").select("*").eq("id", params.id).single()

    if (error || !task) {
      return apiError("Task not found", ApiErrorCode.NOT_FOUND, 404)
    }

    return NextResponse.json({ data: task })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task GET")
    return apiError("Failed to fetch task", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const rl = await rateLimit(`tasks-update:${getClientId(request)}`, { limit: 30, windowSec: 60 })
    if (!rl.allowed) {
      return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .single<ProfileRecord>()

    const scope = await getRequestScope()
    const isAdmin = isAdminProfile(scope)
    const isLead = Boolean(profile?.is_department_lead)

    if (!isAdmin && !isLead) {
      return apiError("Forbidden: Only department leads or administrators can edit tasks", ApiErrorCode.FORBIDDEN, 403)
    }

    const sizeError = checkRequestSize(request)
    if (sizeError) return sizeError

    const parsed = UpdateTaskSchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Validation failed",
        ApiErrorCode.VALIDATION_ERROR,
        400,
        parsed.error.issues
      )
    }

    const payload = parsed.data
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id, title, department, assignment_type, assigned_to, source_type, goal_id, due_date")
      .eq("id", params.id)
      .single()

    if (!existingTask) {
      return apiError("Task not found", ApiErrorCode.NOT_FOUND, 404)
    }

    const finalAssignedTo = payload.assigned_to ?? existingTask.assigned_to ?? null
    let finalDepartment = payload.department ?? existingTask.department ?? null

    const assignmentFieldsTouched = payload.assigned_to !== undefined || payload.department !== undefined

    if (!isAdmin && isLead) {
      if (assignmentFieldsTouched && finalAssignedTo) {
        const { data: assignee } = await supabase
          .from("profiles")
          .select("id, department")
          .eq("id", finalAssignedTo)
          .single()

        if (!assignee || !canAssignToProfile(profile, assignee)) {
          return apiError(
            "You can only assign tasks to users within your approved departmental scope",
            ApiErrorCode.FORBIDDEN,
            403
          )
        }
        finalDepartment = assignee.department || finalDepartment
      }

      if (assignmentFieldsTouched && finalDepartment && !canAssignToDepartment(profile, finalDepartment)) {
        return apiError("You can only assign tasks within your approved department scope", ApiErrorCode.FORBIDDEN, 403)
      }
    }

    const now = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      ...payload,
      updated_by: user.id,
      updated_at: now,
    }

    if (payload.assigned_to !== undefined && payload.assigned_to !== existingTask.assigned_to) {
      updatePayload.assigned_at = now
    }

    if (payload.due_date && payload.due_date !== existingTask.due_date) {
      if (payload.extension_reason) {
        updatePayload.extension_reason = payload.extension_reason
      }
    }

    if (assignmentFieldsTouched) {
      updatePayload.department = finalDepartment
      updatePayload.assigned_to = finalAssignedTo
    }

    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", params.id)
      .select("*")
      .single()

    if (error || !updatedTask) {
      return apiError(error?.message || "Failed to update task", ApiErrorCode.DATABASE_ERROR, 500)
    }

    await writeAuditLog(
      supabase,
      {
        action: "task.update",
        entityType: "task",
        entityId: params.id,
        newValues: updatePayload,
        context: { actorId: user.id, source: "api", route: "/api/tasks/[id]" },
      },
      { failOpen: true }
    )

    // The edit form resends every field, so compare the saved row, not the payload.
    //
    // All of this runs server-side. It used to be fired from the lead's browser
    // after the PATCH returned, which meant closing the tab or losing signal in
    // that window saved the edit and silently dropped the notification — in the
    // month to 20 Sep 2026, three edits to other people's tasks went out with
    // nobody told. Here it cannot be lost by navigating away.
    const newAssigneeId = updatedTask.assigned_to as string | null
    const reassigned = Boolean(newAssigneeId) && newAssigneeId !== existingTask.assigned_to
    const previousDueDate = (existingTask.due_date as string | null) || null
    const newDueDate = (updatedTask.due_date as string | null) || null
    const deadlineMoved = normalizeDate(newDueDate) !== normalizeDate(previousDueDate)

    // Nobody needs telling about their own edit.
    if (newAssigneeId && newAssigneeId !== user.id) {
      const priority = String(updatedTask.priority || "")
      const notifyPriority = priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal"

      try {
        await supabase.rpc("create_notification", {
          p_user_id: newAssigneeId,
          p_type: reassigned ? "task_assigned" : "task_updated",
          p_category: "tasks",
          p_title: reassigned
            ? "New task assigned to you"
            : deadlineMoved
              ? "Deadline changed on your task"
              : "Task updated",
          p_message: reassigned
            ? (updatedTask.title as string)
            : deadlineMoved
              ? `"${updatedTask.title}" — deadline now ${normalizeDate(newDueDate) || "not set"}`
              : `"${updatedTask.title}" — details updated`,
          p_priority: notifyPriority,
          p_link_url: "/tasks",
          p_actor_id: user.id,
          p_entity_type: "task",
          p_entity_id: updatedTask.id,
        })
      } catch (notifyErr) {
        log.error({ err: String(notifyErr), taskId: updatedTask.id }, "Task update notification failed")
      }

      // A moved deadline changes the date they are scored against, so it is
      // emailed as well as shown in-app. Cosmetic edits stay in-app only.
      if (reassigned || deadlineMoved) {
        after(() =>
          sendTaskEmail(supabase, {
            kind: reassigned ? "assigned" : "deadline_changed",
            taskId: updatedTask.id,
            recipientIds: [newAssigneeId],
            replyToUserId: user.id,
            previousDeadline: reassigned ? null : previousDueDate,
          })
        )
      }
    }

    return NextResponse.json({ data: updatedTask })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task PATCH")
    return apiError("Failed to update task", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const rl = await rateLimit(`tasks-delete:${getClientId(request)}`, { limit: 30, windowSec: 60 })
    if (!rl.allowed) {
      return apiError("Too many requests. Please try again later.", ApiErrorCode.RATE_LIMITED, 429)
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .single<ProfileRecord>()

    const scope = await getRequestScope()
    const isAdmin = isAdminProfile(scope)
    const isLead = Boolean(profile?.is_department_lead)

    if (!isAdmin && !isLead) {
      return apiError(
        "Forbidden: Only department leads or administrators can archive tasks",
        ApiErrorCode.FORBIDDEN,
        403
      )
    }

    const now = new Date().toISOString()

    // One row, one task. This used to archive every row sharing a fan-out
    // group id, on the theory that a multi-assign was one thing the lead had
    // created. It is not: the table lists each assignee's task under its own
    // work item number, and deleting the one in front of you should not clear
    // three other people's lists.
    const archivePayload = {
      is_archived: true,
      archived_by: user.id,
      archived_at: now,
      updated_by: user.id,
      updated_at: now,
    }

    const { data: archivedTask, error } = await supabase
      .from("tasks")
      .update(archivePayload)
      .eq("id", params.id)
      .select()
      .maybeSingle()

    if (error) return apiError(error.message, ApiErrorCode.DATABASE_ERROR, 500)

    await writeAuditLog(
      supabase,
      {
        action: "task.archive",
        entityType: "task",
        entityId: params.id,
        oldValues: { is_archived: false },
        newValues: {
          is_archived: true,
          archived_by: user.id,
          archived_at: now,
        },
        context: { actorId: user.id, source: "api", route: "/api/tasks/[id]" },
      },
      { failOpen: true }
    )

    return NextResponse.json({
      success: true,
      data: archivedTask,
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task DELETE")
    return apiError("Failed to archive task", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}
