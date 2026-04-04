import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"

const log = logger("project-updates-route")

const UpdateSchema = z.object({
  content: z.string().trim().min(1),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const [{ data: project }, { data: membership }, { data: profile }] = await Promise.all([
      supabase.from("projects").select("id, project_manager_id, created_by").eq("id", params.id).maybeSingle(),
      supabase
        .from("project_members")
        .select("role")
        .eq("project_id", params.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role?: string | null }>(),
    ])
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    const isAdmin = ["developer", "admin", "super_admin"].includes(String(profile?.role || "").toLowerCase())
    const canComment =
      isAdmin || project.project_manager_id === user.id || project.created_by === user.id || Boolean(membership)
    if (!canComment) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const parsed = UpdateSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request body" }, { status: 400 })
    const { data, error } = await supabase
      .from("project_updates")
      .insert({ project_id: params.id, user_id: user.id, update_type: "comment", content: parsed.data.content })
      .select(
        `id, content, update_type, created_at, user:profiles!project_updates_user_id_fkey (first_name, last_name)`
      )
      .single()
    if (error || !data)
      return NextResponse.json({ error: error?.message || "Failed to create update" }, { status: 500 })
    await writeAuditLog(
      supabase,
      {
        action: "project.comment",
        entityType: "project",
        entityId: params.id,
        newValues: { content: parsed.data.content },
        context: { actorId: user.id, source: "api", route: "/api/projects/[id]/updates" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in project update POST")
    return NextResponse.json({ error: "Failed to add project update" }, { status: 500 })
  }
}
