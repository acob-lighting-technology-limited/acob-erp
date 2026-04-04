import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"

const log = logger("projects-route")

const ProjectSchema = z.object({
  project_name: z.string().trim().min(1),
  location: z.string().trim().min(1),
  deployment_start_date: z.string().trim().min(1),
  deployment_end_date: z.string().trim().min(1),
  capacity_w: z.number().optional().nullable(),
  technology_type: z.string().optional().nullable(),
  project_manager_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
})

function isAdmin(role: string | null | undefined) {
  return ["admin", "super_admin", "developer"].includes(String(role || "").toLowerCase())
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in projects GET")
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role?: string | null }>()
    if (!isAdmin(profile?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const parsed = ProjectSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request body" }, { status: 400 })
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...parsed.data, created_by: user.id, status: parsed.data.status || "planning" })
      .select("*")
      .single()
    if (error || !data)
      return NextResponse.json({ error: error?.message || "Failed to create project" }, { status: 500 })
    await writeAuditLog(
      supabase,
      {
        action: "project.create",
        entityType: "project",
        entityId: data.id,
        newValues: parsed.data,
        context: { actorId: user.id, source: "api", route: "/api/projects" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in projects POST")
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const projectId = request.nextUrl.searchParams.get("id")
    if (!projectId) return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    const parsed = ProjectSchema.partial().safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request body" }, { status: 400 })
    const [{ data: profile }, { data: existing }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single<{ role?: string | null }>(),
      supabase.from("projects").select("id, status, project_manager_id").eq("id", projectId).single(),
    ])
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    if (!isAdmin(profile?.role) && existing.project_manager_id !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { data: updated, error } = await supabase
      .from("projects")
      .update(parsed.data)
      .eq("id", projectId)
      .select("*")
      .single()
    if (error || !updated)
      return NextResponse.json({ error: error?.message || "Failed to update project" }, { status: 500 })
    if (typeof parsed.data.status !== "undefined" && parsed.data.status !== existing.status) {
      await supabase
        .from("project_updates")
        .insert({
          project_id: projectId,
          user_id: user.id,
          update_type: "status_change",
          content: `Status changed to ${parsed.data.status}`,
        })
    }
    await writeAuditLog(
      supabase,
      {
        action: "project.update",
        entityType: "project",
        entityId: projectId,
        newValues: parsed.data,
        context: { actorId: user.id, source: "api", route: "/api/projects" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ data: updated })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in projects PATCH")
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const projectId = request.nextUrl.searchParams.get("id")
    if (!projectId) return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role?: string | null }>()
    if (!isAdmin(profile?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { error } = await supabase.from("projects").delete().eq("id", projectId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeAuditLog(
      supabase,
      {
        action: "project.delete",
        entityType: "project",
        entityId: projectId,
        context: { actorId: user.id, source: "api", route: "/api/projects" },
      },
      { failOpen: true }
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in projects DELETE")
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
