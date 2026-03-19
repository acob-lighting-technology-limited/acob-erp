import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AdminProjectsContent } from "./admin-projects-content"
import { canAccessAdminSection, getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { listAssignableProfiles } from "@/lib/workforce/assignment-policy"

export interface Project {
  id: string
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w?: number
  technology_type?: string
  description?: string
  status: string
  created_at: string
  project_manager_id?: string
  project_manager?: {
    first_name: string
    last_name: string
  }
  created_by_user?: {
    first_name: string
    last_name: string
  }
}

export interface employee {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
  employment_status?: string | null
}

async function getAdminProjectsData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !canAccessAdminSection(scope, "projects")) {
    return { redirect: "/profile" as const }
  }
  const departmentScope = getDepartmentScope(scope, "general")

  // Fetch projects and employee in parallel
  const [projectsResult, employeeResult] = await Promise.all([
    dataClient
      .from("projects")
      .select(
        `
        *,
        project_manager:profiles!projects_project_manager_id_fkey (
          first_name,
          last_name
        ),
        created_by_user:profiles!projects_created_by_fkey (
          first_name,
          last_name
        )
      `
      )
      .order("created_at", { ascending: false }),
    listAssignableProfiles(dataClient, {
      select: "id, first_name, last_name, company_email, department, employment_status",
      departmentScope,
      allowLegacyNullStatus: false,
    }),
  ])

  return {
    projects: (projectsResult.data || []) as Project[],
    employee: (employeeResult.data || []) as employee[],
  }
}

export default async function AdminProjectsPage() {
  const data = await getAdminProjectsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const projectsData = data as Exclude<
    Awaited<ReturnType<typeof getAdminProjectsData>>,
    { redirect: "/auth/login" | "/profile" }
  >

  return <AdminProjectsContent initialProjects={projectsData.projects} initialemployee={projectsData.employee} />
}
