import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { resolveAutoLinkedGoalId } from "@/lib/performance/goal-linking"
import {
  canAssignTasks,
  canAssignToDepartment,
  canAssignToProfile,
  type TaskAssignmentAuthorityProfile,
  type TaskAssignmentTargetProfile,
} from "@/lib/tasks/assignment-scope"

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
  id: string
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
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

const CreateProjectTaskSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  description: z.string().optional(),
  assignment_type: z.enum(["individual", "multiple", "department"]).default("individual"),
  assigned_to: z.string().trim().optional().default(""),
  assigned_users: z.array(z.string().trim().min(1)).optional().default([]),
  department: z.string().trim().optional().default(""),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  due_date: z.string().optional().nullable(),
  task_start_date: z.string().optional().nullable(),
  task_end_date: z.string().optional().nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateProjectTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const title = parsed.data.title
    const description = (parsed.data.description || "").trim()
    const assignmentType = parsed.data.assignment_type
    const assignedTo = parsed.data.assigned_to
    const assignedUsers = parsed.data.assigned_users
    const department = parsed.data.department
    const priority = parsed.data.priority
    const dueDate = parsed.data.due_date ?? null
    const taskStartDate = parsed.data.task_start_date ?? null
    const taskEndDate = parsed.data.task_end_date ?? null

    const [projectResult, memberRoleResult, profileResult, projectMembersResult] = await Promise.all([
      supabase
        .from("projects")
        .select("id, project_name, project_manager_id, created_by")
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("project_members")
        .select("role")
        .eq("project_id", params.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, role, department, is_department_lead, lead_departments")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("project_members")
        .select("user_id, user:profiles!project_members_user_id_fkey(first_name, last_name, department, company_email)")
        .eq("project_id", params.id)
        .eq("is_active", true),
    ])

    const project = (projectResult.data as ProjectRow | null) || null
    const memberRole = (memberRoleResult.data as MemberRoleRow | null) || null
    const profile = (profileResult.data as ProfileRoleRow | null) || null
    const projectMembers = (projectMembersResult.data as AssigneeMemberRow[] | null) || []

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

    const assignerProfile = profile as TaskAssignmentAuthorityProfile | null
    if (!assignerProfile || !canAssignTasks(assignerProfile)) {
      return NextResponse.json({ error: "Only department leads, HCS, or MD can assign tasks." }, { status: 403 })
    }

    let resolvedDepartment: string | null = null

    if (assignmentType === "individual") {
      if (!assignedTo) {
        return NextResponse.json({ error: "Assignee is required for project task assignment." }, { status: 400 })
      }

      const assigneeMember = projectMembers.find((member) => member.user_id === assignedTo)
      if (!assigneeMember) {
        return NextResponse.json(
          { error: "Selected assignee is not an active member of this project." },
          { status: 400 }
        )
      }

      const assigneeProfile: TaskAssignmentTargetProfile = {
        id: assignedTo,
        department: assigneeMember.user?.department || null,
      }

      if (!canAssignToProfile(assignerProfile, assigneeProfile)) {
        return NextResponse.json({ error: "You can only assign tasks within your approved scope." }, { status: 403 })
      }

      resolvedDepartment = assigneeMember.user?.department || null
    }

    if (assignmentType === "multiple") {
      if (assignedUsers.length === 0) {
        return NextResponse.json({ error: "Select at least one project member for group tasks." }, { status: 400 })
      }

      for (const memberId of assignedUsers) {
        const member = projectMembers.find((candidate) => candidate.user_id === memberId)
        if (!member) {
          return NextResponse.json({ error: "All selected assignees must be active project members." }, { status: 400 })
        }

        if (!canAssignToProfile(assignerProfile, { id: member.user_id, department: member.user?.department || null })) {
          return NextResponse.json({ error: "You can only assign tasks within your approved scope." }, { status: 403 })
        }
      }

      const departments = Array.from(
        new Set(
          projectMembers
            .filter((member) => assignedUsers.includes(member.user_id))
            .map((member) => member.user?.department || "")
            .filter(Boolean)
        )
      )
      resolvedDepartment = departments.length === 1 ? departments[0] || null : null
    }

    if (assignmentType === "department") {
      if (!department) {
        return NextResponse.json({ error: "Department is required for department project tasks." }, { status: 400 })
      }

      if (!canAssignToDepartment(assignerProfile, department)) {
        return NextResponse.json({ error: "You can only assign tasks within your approved scope." }, { status: 403 })
      }

      resolvedDepartment = department
    }

    const taskPayload = {
      title,
      description: description || null,
      priority,
      status: "pending",
      assigned_to: assignmentType === "individual" ? assignedTo : null,
      assigned_by: user.id,
      department: resolvedDepartment,
      due_date: dueDate,
      project_id: params.id,
      task_start_date: taskStartDate,
      task_end_date: taskEndDate,
      source_type: "project_task",
      assignment_type: assignmentType,
    }

    const { data: createdTask, error: taskError } = await supabase
      .from("tasks")
      .insert(taskPayload)
      .select("id, title, work_item_number, goal_id")
      .single()

    if (taskError || !createdTask) {
      throw taskError || new Error("Failed to create project task")
    }

    if (assignmentType === "multiple" && assignedUsers.length > 0) {
      await supabase
        .from("task_assignments")
        .insert(assignedUsers.map((userId) => ({ task_id: createdTask.id, user_id: userId })))
    }

    const autoGoalId = await resolveAutoLinkedGoalId({
      supabase,
      actorId: user.id,
      assignedTo: assignmentType === "individual" ? assignedTo : null,
      department: resolvedDepartment,
      sourceType: "project_task",
      title,
    })

    const finalTask =
      autoGoalId && autoGoalId !== createdTask.goal_id
        ? (
            await supabase
              .from("tasks")
              .update({ goal_id: autoGoalId, updated_at: new Date().toISOString() })
              .eq("id", createdTask.id)
              .select("id, title, work_item_number, goal_id")
              .single()
          ).data || createdTask
        : createdTask

    const assigneeLabel =
      assignmentType === "individual"
        ? projectMembers.find((member) => member.user_id === assignedTo)?.user
          ? `${projectMembers.find((member) => member.user_id === assignedTo)?.user?.first_name || "team member"} ${projectMembers.find((member) => member.user_id === assignedTo)?.user?.last_name || ""}`.trim()
          : "team member"
        : assignmentType === "multiple"
          ? `${assignedUsers.length} team members`
          : resolvedDepartment || "department"

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
        content: `Assigned ${createdTask.title} to ${assigneeLabel}`.trim(),
      }),
      ...(assignmentType === "individual"
        ? [
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
              p_entity_id: finalTask.id,
              p_rich_content: {
                project_id: params.id,
                project_name: project.project_name,
              },
            }),
          ]
        : []),
    ])

    return NextResponse.json({
      data: finalTask,
    })
  } catch (error) {
    log.error({ err: String(error) }, "Error creating project task")
    return NextResponse.json({ error: "Failed to create project task" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return PATCH(request, { params })
}
