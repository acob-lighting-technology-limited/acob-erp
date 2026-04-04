import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listAssignableProfiles, isAssignableProfile } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"

const log = logger("project-detail-route")

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [projectResult, employeesResult, membersResult, itemsResult, tasksResult] = await Promise.all([
      supabase
        .from("projects")
        .select(
          `*, project_manager:profiles!projects_project_manager_id_fkey (id, first_name, last_name, company_email)`
        )
        .eq("id", params.id)
        .single(),
      listAssignableProfiles(supabase, {
        select: "id, first_name, last_name, company_email, department, employment_status",
        allowLegacyNullStatus: false,
      }),
      supabase
        .from("project_members")
        .select(
          `id, user_id, role, assigned_at, user:profiles!project_members_user_id_fkey (id, first_name, last_name, company_email, department)`
        )
        .eq("project_id", params.id)
        .eq("is_active", true)
        .order("assigned_at", { ascending: false }),
      supabase.from("project_items").select("*").eq("project_id", params.id).order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select(
          `id, title, work_item_number, description, priority, status, progress, due_date, task_start_date, task_end_date,
        assigned_to_user:profiles!tasks_assigned_to_fkey (first_name, last_name)`
        )
        .eq("project_id", params.id)
        .order("created_at", { ascending: false }),
    ])

    if (projectResult.error) return NextResponse.json({ error: projectResult.error.message }, { status: 500 })

    const employees = ((employeesResult.data || []) as Array<{ employment_status?: string | null }>).filter((profile) =>
      isAssignableProfile(profile, { allowLegacyNullStatus: false })
    )

    return NextResponse.json({
      data: {
        project: projectResult.data,
        employees,
        members: membersResult.data || [],
        items: itemsResult.data || [],
        tasks: tasksResult.data || [],
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in project detail GET")
    return NextResponse.json({ error: "Failed to fetch project detail" }, { status: 500 })
  }
}
