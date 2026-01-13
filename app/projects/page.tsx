import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProjectsContent } from "./projects-content"

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
  project_manager?: {
    first_name: string
    last_name: string
  }
  created_by_user?: {
    first_name: string
    last_name: string
  }
}

async function getProjectsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get projects where user is a member, manager, or creator
  const { data: memberProjects, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (memberError) {
    console.error("Error loading member projects:", memberError)
  }

  const projectIds = memberProjects?.map((m) => m.project_id) || []

  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      project_name,
      location,
      deployment_start_date,
      deployment_end_date,
      capacity_w,
      technology_type,
      description,
      status,
      created_at,
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
    .or(`id.in.(${projectIds.join(",")}),project_manager_id.eq.${user.id},created_by.eq.${user.id}`)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error loading projects:", error)
  }

  return {
    projects: (data as any) || [],
  }
}

export default async function ProjectsPage() {
  const data = await getProjectsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const projectsData = data as { projects: Project[] }

  return <ProjectsContent initialProjects={projectsData.projects} />
}
