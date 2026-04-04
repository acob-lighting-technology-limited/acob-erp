import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"

const log = logger("tasks-comments-route")

const CommentBodySchema = z.object({
  content: z.string().trim().min(1).max(5000),
})

type ProfileRecord = {
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

function canLeadDepartment(profile: ProfileRecord | null, department: string | null | undefined) {
  if (!profile?.is_department_lead || !department) return false
  const leadDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return profile.department === department || leadDepartments.includes(department)
}

function isPrivileged(profile: ProfileRecord | null) {
  const role = String(profile?.role || "").toLowerCase()
  return role === "developer" || role === "admin" || role === "super_admin"
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = CommentBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const [{ data: task }, { data: profile }, { data: assignments }] = await Promise.all([
      supabase.from("tasks").select("id, assigned_to, assigned_by, department").eq("id", params.id).single(),
      supabase
        .from("profiles")
        .select("role, department, is_department_lead, lead_departments")
        .eq("id", user.id)
        .single<ProfileRecord>(),
      supabase.from("task_assignments").select("user_id").eq("task_id", params.id).eq("user_id", user.id).limit(1),
    ])

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const canAccess =
      task.assigned_to === user.id ||
      task.assigned_by === user.id ||
      Boolean(assignments && assignments.length > 0) ||
      isPrivileged(profile ?? null) ||
      canLeadDepartment(profile ?? null, task.department)

    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: comment, error } = await supabase
      .from("task_updates")
      .insert({
        task_id: params.id,
        user_id: user.id,
        update_type: "comment",
        content: parsed.data.content,
      })
      .select("*")
      .single()

    if (error || !comment) {
      return NextResponse.json({ error: error?.message || "Failed to create comment" }, { status: 500 })
    }

    await writeAuditLog(
      supabase,
      {
        action: "task.comment_create",
        entityType: "task",
        entityId: params.id,
        newValues: { content: parsed.data.content },
        context: { actorId: user.id, source: "api", route: "/api/tasks/[id]/comments" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: comment })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in task comments POST")
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }
}
