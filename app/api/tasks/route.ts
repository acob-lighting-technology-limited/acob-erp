import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { resolveAutoLinkedGoalId } from "@/lib/performance/goal-linking"
import {
  canAssignTasks,
  canAssignToDepartment,
  canAssignToProfile,
  type TaskAssignmentAuthorityProfile,
  type TaskAssignmentTargetProfile,
} from "@/lib/tasks/assignment-scope"

const log = logger("tasks-route")

const TaskBodySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  priority: z.string().trim().min(1),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  due_date: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assignment_type: z.enum(["individual", "multiple", "department"]),
  assigned_to: z.string().uuid().optional().nullable(),
  assigned_users: z.array(z.string().uuid()).optional().default([]),
  project_id: z.string().uuid().optional().nullable(),
  goal_id: z.string().uuid().optional().nullable(),
  task_start_date: z.string().optional().nullable(),
  task_end_date: z.string().optional().nullable(),
  source_type: z.enum(["manual", "project_task"]).default("manual"),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .single<TaskAssignmentAuthorityProfile>()

    if (!profile || !canAssignTasks(profile)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = TaskBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const payload = parsed.data
    let resolvedDepartment = payload.department || null

    if (payload.assignment_type === "individual") {
      if (!payload.assigned_to) {
        return NextResponse.json({ error: "Assignee is required for individual tasks" }, { status: 400 })
      }

      const { data: assignee } = await supabase
        .from("profiles")
        .select("id, department")
        .eq("id", payload.assigned_to)
        .single<TaskAssignmentTargetProfile>()

      if (!assignee) {
        return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 })
      }

      if (!canAssignToProfile(profile, assignee)) {
        return NextResponse.json({ error: "You can only assign tasks within your approved scope" }, { status: 403 })
      }

      resolvedDepartment = assignee.department || resolvedDepartment
    }

    if (payload.assignment_type === "multiple") {
      if (payload.assigned_users.length === 0) {
        return NextResponse.json({ error: "At least one assignee is required for group tasks" }, { status: 400 })
      }

      const { data: assignees } = await supabase
        .from("profiles")
        .select("id, department")
        .in("id", payload.assigned_users)

      const typedAssignees = (assignees || []) as TaskAssignmentTargetProfile[]
      if (typedAssignees.length !== payload.assigned_users.length) {
        return NextResponse.json({ error: "One or more selected assignees were not found" }, { status: 400 })
      }

      const invalidAssignee = typedAssignees.find((assignee) => !canAssignToProfile(profile, assignee))
      if (invalidAssignee) {
        return NextResponse.json({ error: "You can only assign tasks within your approved scope" }, { status: 403 })
      }

      const departments = Array.from(new Set(typedAssignees.map((assignee) => assignee.department).filter(Boolean)))
      resolvedDepartment = departments.length === 1 ? departments[0] || null : resolvedDepartment
    }

    if (payload.assignment_type === "department") {
      if (!payload.department) {
        return NextResponse.json({ error: "Department is required for department tasks" }, { status: 400 })
      }

      if (!canAssignToDepartment(profile, payload.department)) {
        return NextResponse.json({ error: "You can only assign tasks within your approved scope" }, { status: 403 })
      }
    }

    const insertPayload = {
      title: payload.title,
      description: payload.description || null,
      priority: payload.priority,
      status: payload.status,
      due_date: payload.due_date || null,
      department: resolvedDepartment,
      assignment_type: payload.assignment_type,
      assigned_to: payload.assignment_type === "individual" ? payload.assigned_to || null : null,
      assigned_by: user.id,
      project_id: payload.project_id || null,
      goal_id: payload.goal_id || null,
      task_start_date: payload.task_start_date || null,
      task_end_date: payload.task_end_date || null,
      source_type: payload.source_type,
    }

    const { data: task, error } = await supabase.from("tasks").insert(insertPayload).select("*").single()
    if (error || !task) {
      return NextResponse.json({ error: error?.message || "Failed to create task" }, { status: 500 })
    }

    if (payload.assignment_type === "multiple" && payload.assigned_users.length > 0) {
      const assignments = payload.assigned_users.map((userId) => ({ task_id: task.id, user_id: userId }))
      await supabase.from("task_assignments").insert(assignments)
    }

    const autoGoalId =
      payload.assignment_type === "individual"
        ? await resolveAutoLinkedGoalId({
            supabase,
            actorId: user.id,
            assignedTo: payload.assigned_to || null,
            department: payload.department || null,
            sourceType: payload.source_type,
            title: payload.title,
            explicitGoalId: payload.goal_id || null,
          })
        : payload.goal_id || null

    const finalTask =
      autoGoalId && autoGoalId !== task.goal_id
        ? (
            await supabase
              .from("tasks")
              .update({ goal_id: autoGoalId, updated_at: new Date().toISOString() })
              .eq("id", task.id)
              .select("*")
              .single()
          ).data || task
        : task

    await writeAuditLog(
      supabase,
      {
        action: "task.create",
        entityType: "task",
        entityId: task.id,
        newValues: { title: finalTask.title, status: finalTask.status, goal_id: finalTask.goal_id },
        context: { actorId: user.id, source: "api", route: "/api/tasks" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: finalTask }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in tasks POST")
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}
