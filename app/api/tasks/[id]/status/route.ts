import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"

const log = logger("tasks-status-route")

const StatusBodySchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  comment: z.string().trim().max(5000).optional(),
})

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "pending", "cancelled"],
  completed: [],
  cancelled: ["pending"],
}

type TaskRecord = {
  id: string
  status: string
  goal_id?: string | null
  assignment_type?: string | null
  assigned_to?: string | null
  assigned_by?: string | null
  department?: string | null
  started_at?: string | null
  completed_at?: string | null
  work_item_number?: string | null
}

type ProfileRecord = {
  id: string
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

function isAdminProfile(profile: ProfileRecord | null) {
  const role = String(profile?.role || "").toLowerCase()
  return role === "developer" || role === "admin" || role === "super_admin"
}

function isLeadForTask(profile: ProfileRecord | null, taskDepartment: string | null | undefined) {
  if (!profile?.is_department_lead || !taskDepartment) return false
  const leadDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return profile.department === taskDepartment || leadDepartments.includes(taskDepartment)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = StatusBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        "id, status, goal_id, assignment_type, assigned_to, assigned_by, department, started_at, completed_at, work_item_number"
      )
      .eq("id", params.id)
      .single<TaskRecord>()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const [{ data: profile }, { data: assignments }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, department, is_department_lead, lead_departments")
        .eq("id", user.id)
        .single<ProfileRecord>(),
      supabase.from("task_assignments").select("user_id").eq("task_id", task.id).eq("user_id", user.id).limit(1),
    ])

    const isAdmin = isAdminProfile(profile)
    const hasAssignment = Boolean(assignments && assignments.length > 0)
    const canAccess =
      task.assigned_to === user.id ||
      task.assigned_by === user.id ||
      hasAssignment ||
      isAdmin ||
      isLeadForTask(profile ?? null, task.department)

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!task.goal_id) {
      return NextResponse.json({ error: "Task must be linked to a goal before it can be updated" }, { status: 400 })
    }

    // Policy: department tasks are updated by department leads only.
    if (task.assignment_type === "department" && !isLeadForTask(profile ?? null, task.department)) {
      return NextResponse.json({ error: "Only department leads can update department tasks" }, { status: 403 })
    }

    const oldStatus = task.status
    const nextStatus = parsed.data.status
    if (oldStatus === nextStatus) {
      return NextResponse.json({ success: true, task })
    }

    if (!isAdmin) {
      const allowed = VALID_TRANSITIONS[oldStatus] || []
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json({ error: `Cannot transition from ${oldStatus} to ${nextStatus}` }, { status: 400 })
      }
    }

    const now = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    }

    if (nextStatus === "completed") updatePayload.completed_at = now
    if (nextStatus === "in_progress" && oldStatus === "pending" && !task.started_at) updatePayload.started_at = now

    const { data: updatedTask, error: updateError } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", task.id)
      .select("*")
      .single()

    if (updateError || !updatedTask) {
      return NextResponse.json({ error: updateError?.message || "Failed to update task" }, { status: 500 })
    }

    if (parsed.data.comment) {
      await supabase.from("task_updates").insert({
        task_id: task.id,
        user_id: user.id,
        update_type: "status_change",
        content: parsed.data.comment,
        old_value: oldStatus,
        new_value: nextStatus,
      })
    }

    if (nextStatus === "completed" && task.assigned_by && task.assigned_by !== user.id) {
      await supabase.rpc("create_notification", {
        p_user_id: task.assigned_by,
        p_type: "task_completed",
        p_category: "tasks",
        p_title: "Task completed",
        p_message: `${task.work_item_number || "Task"} is now completed`,
        p_priority: "normal",
        p_link_url: "/tasks/management",
        p_actor_id: user.id,
        p_entity_type: "task",
        p_entity_id: task.id,
        p_rich_content: { status: nextStatus, work_item_number: task.work_item_number },
      })
    }

    await writeAuditLog(
      supabase,
      {
        action: "task.status_update",
        entityType: "task",
        entityId: task.id,
        oldValues: { status: oldStatus },
        newValues: { status: nextStatus },
        context: { actorId: user.id, source: "api", route: "/api/tasks/[id]/status" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true, task: updatedTask })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task status PATCH")
    return NextResponse.json({ error: "Failed to update task status" }, { status: 500 })
  }
}
