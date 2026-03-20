import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger("api-project-tasks-create")

type ProjectRow = {
  id: string
  project_name: string
  project_manager_id?: string | null
  created_by?: string | null
}

type MemberRoleRow = {
  role?: string | null
}

type ProfileRoleRow = {
  role?: string | null
}

type AssigneeMemberRow = {
  user_id: string
  user?: {
    first_name?: string | null
    last_name?: string | null
    department?: string | null
    company_email?: string | null
  } | null
}

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "urgent"])

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const title = String(body?.title || "").trim()
    const description = String(body?.description || "").trim()
    const assignedTo = String(body?.assigned_to || "").trim()
    const priority = String(body?.priority || "medium").trim().toLowerCase()
    const dueDate = body?.due_date ? String(body.due_date) : null
    const taskStartDate = body?.task_start_date ? String(body.task_start_date) : null
    const taskEndDate = body?.task_end_date ? String(body.task_end_date) : null

    if (!title || !assignedTo) {
      return NextResponse.json({ error: "title and assigned_to are required" }, { status: 400 })
    }

    if (!ALLOWED_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
    }

    const [projectResult, memberRoleResult, profileResult, assigneeResult] = await Promise.all([
      supabase.from("projects").select("id, project_name, project_manager_id, created_by").eq("id", params.id).maybeSingle(),
      supabase
        .from("project_members")
        .select("role")
        .eq("project_id", params.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase
        .from("project_members")
        .select(
          "user_id, user:profiles!project_members_user_id_fkey(first_name, last_name, department, company_email)"
        )
        .eq("project_id", params.id)
        .eq("user_id", assignedTo)
        .eq("is_active", true)
        .maybeSingle(),
    ])

    const project = (projectResult.data as ProjectRow | null) || null
    const memberRole = (memberRoleResult.data as MemberRoleRow | null) || null
    const profile = (profileResult.data as ProfileRoleRow | null) || null
    const assigneeMember = (assigneeResult.data as AssigneeMemberRow | null) || null

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const canManageTasks =
      project.project_manager_id === user.id ||
      project.created_by === user.id ||
      memberRole?.role === "lead" ||
      ["admin", "developer", "super_admin"].includes(profile?.role || "")

    if (!canManageTasks) {
      return NextResponse.json({ error: "You are not allowed to assign project tasks." }, { status: 403 })
    }

    if (!assigneeMember) {
      return NextResponse.json({ error: "Selected assignee is not an active member of this project." }, { status: 400 })
    }

    const taskPayload = {
      title,
      description: description || null,
      priority,
      status: "pending",
      assigned_to: assignedTo,
      assigned_by: user.id,
      department: assigneeMember.user?.department || null,
      due_date: dueDate,
      project_id: params.id,
      task_start_date: taskStartDate,
      task_end_date: taskEndDate,
      source_type: "project_task",
      assignment_type: "individual",
    }

    const { data: createdTask, error: taskError } = await supabase
      .from("tasks")
      .insert(taskPayload)
      .select("id, title, work_item_number")
      .single()

    if (taskError || !createdTask) {
      throw taskError || new Error("Failed to create project task")
    }

    await Promise.all([
      supabase.from("task_updates").insert({
        task_id: createdTask.id,
        user_id: user.id,
        update_type: "task_created",
        content: `Task created from project ${project.project_name}`,
      }),
      supabase.from("project_updates").insert({
        project_id: params.id,
        user_id: user.id,
        update_type: "task_created",
        content: `Assigned ${createdTask.title} to ${assigneeMember.user?.first_name || "team member"} ${assigneeMember.user?.last_name || ""}`.trim(),
      }),
      supabase.rpc("create_notification", {
        p_user_id: assignedTo,
        p_type: "task_assigned",
        p_category: "tasks",
        p_title: "Project task assigned",
        p_message: `${createdTask.work_item_number || createdTask.title} - ${project.project_name}`,
        p_priority: priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal",
        p_link_url: `/projects/${params.id}`,
        p_actor_id: user.id,
        p_entity_type: "task",
        p_entity_id: createdTask.id,
        p_rich_content: {
          project_id: params.id,
          project_name: project.project_name,
        },
      }),
    ])

    return NextResponse.json({
      data: createdTask,
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error creating project task")
    return NextResponse.json({ error: "Failed to create project task" }, { status: 500 })
  }
}
