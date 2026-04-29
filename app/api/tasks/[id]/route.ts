import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import {
  canAssignTasks,
  canAssignToDepartment,
  canAssignToProfile,
  type TaskAssignmentAuthorityProfile,
  type TaskAssignmentTargetProfile,
} from "@/lib/tasks/assignment-scope"

const log = logger("task-detail-route")

const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: z.string().trim().min(1).optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  due_date: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assignment_type: z.enum(["individual", "department"]).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  goal_id: z.string().uuid().optional().nullable(),
  task_start_date: z.string().optional().nullable(),
  task_end_date: z.string().optional().nullable(),
})

async function assertManagerAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, department, is_department_lead, lead_departments")
    .eq("id", userId)
    .single<TaskAssignmentAuthorityProfile>()

  return profile && canAssignTasks(profile) ? profile : null
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const assignerProfile = await assertManagerAccess(supabase, user.id)
    if (!assignerProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = UpdateTaskSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const payload = parsed.data
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id, title, department, assignment_type, assigned_to, source_type, goal_id")
      .eq("id", params.id)
      .single<{
        id: string
        title?: string | null
        department?: string | null
        assignment_type?: string | null
        assigned_to?: string | null
        source_type?: "manual" | "help_desk" | null
        goal_id?: string | null
      }>()

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const finalAssignmentType = payload.assignment_type || existingTask.assignment_type || "individual"
    const finalAssignedTo =
      finalAssignmentType === "individual" ? (payload.assigned_to ?? existingTask.assigned_to ?? null) : null
    let finalDepartment = payload.department ?? existingTask.department ?? null

    const assignmentFieldsTouched =
      payload.assignment_type !== undefined || payload.assigned_to !== undefined || payload.department !== undefined

    if (assignmentFieldsTouched && finalAssignmentType === "individual") {
      if (!finalAssignedTo) {
        return NextResponse.json({ error: "Assignee is required for individual tasks" }, { status: 400 })
      }

      const { data: assignee } = await supabase
        .from("profiles")
        .select("id, department")
        .eq("id", finalAssignedTo)
        .single<TaskAssignmentTargetProfile>()

      if (!assignee) {
        return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 })
      }

      if (!canAssignToProfile(assignerProfile, assignee)) {
        return NextResponse.json({ error: "You can only assign tasks within your approved scope" }, { status: 403 })
      }

      finalDepartment = assignee.department || finalDepartment
    }

    if (assignmentFieldsTouched && finalAssignmentType === "department") {
      if (!finalDepartment) {
        return NextResponse.json({ error: "Department is required for department tasks" }, { status: 400 })
      }
      if (!canAssignToDepartment(assignerProfile, finalDepartment)) {
        return NextResponse.json({ error: "You can only assign tasks within your approved scope" }, { status: 403 })
      }
    }

    const updatePayload: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() }
    if ((payload.assignment_type || "").length > 0) {
      updatePayload.assigned_to = payload.assignment_type === "individual" ? payload.assigned_to || null : null
    }
    if (assignmentFieldsTouched) {
      updatePayload.department = finalDepartment
    }

    if (payload.goal_id !== undefined) {
      updatePayload.goal_id = payload.goal_id
    }

    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", params.id)
      .select("*")
      .single()

    if (error || !updatedTask) {
      return NextResponse.json({ error: error?.message || "Failed to update task" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "task.update",
        entityType: "task",
        entityId: params.id,
        newValues: payload,
        context: { actorId: user.id, source: "api", route: "/api/tasks/[id]" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updatedTask })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task PATCH")
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await assertManagerAccess(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: existingTask } = await supabase.from("tasks").select("id, title, status").eq("id", params.id).single()

    const { error } = await supabase.from("tasks").delete().eq("id", params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(
      supabase,
      {
        action: "task.delete",
        entityType: "task",
        entityId: params.id,
        oldValues: existingTask || null,
        context: { actorId: user.id, source: "api", route: "/api/tasks/[id]" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task DELETE")
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
