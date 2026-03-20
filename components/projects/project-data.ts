import { createClient } from "@/lib/supabase/client"

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
  project_manager_id?: string | null
  project_manager?: {
    id: string
    first_name: string
    last_name: string
    company_email?: string | null
  } | null
}

export interface Employee {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
}

export interface ProjectMember {
  id: string
  user_id: string
  role: string
  assigned_at: string
  user: Employee
}

export interface ProjectItem {
  id: string
  item_name: string
  description?: string
  quantity: number
  unit?: string
  status: string
  notes?: string
}

export interface ProjectPageData {
  project: Project
  employees: Employee[]
  members: ProjectMember[]
  items: ProjectItem[]
  tasks: Array<{
    id: string
    title: string
    work_item_number?: string | null
    description?: string
    priority: string
    status: string
    progress?: number | null
    due_date?: string
    task_start_date?: string
    task_end_date?: string
    assigned_to_user?: {
      first_name: string
      last_name: string
    } | null
  }>
}

export async function fetchAdminProjectDetail(projectId: string): Promise<ProjectPageData> {
  const supabase = createClient()
  const [
    { data: projectData, error: projectError },
    { data: employeesData, error: employeesError },
    { data: membersData, error: membersError },
    { data: itemsData, error: itemsError },
    { data: tasksData, error: tasksError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(`*, project_manager:profiles!projects_project_manager_id_fkey (id, first_name, last_name, company_email)`)
      .eq("id", projectId)
      .single(),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, company_email, department")
      .order("last_name", { ascending: true }),
    supabase
      .from("project_members")
      .select(
        `id, user_id, role, assigned_at, user:profiles!project_members_user_id_fkey (id, first_name, last_name, company_email, department)`
      )
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("assigned_at", { ascending: false }),
    supabase.from("project_items").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select(
        `id, title, work_item_number, description, priority, status, progress, due_date, task_start_date, task_end_date,
        assigned_to_user:profiles!tasks_assigned_to_fkey (first_name, last_name)`
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ])
  if (projectError) throw new Error(projectError.message)
  if (employeesError) throw new Error(employeesError.message)
  if (membersError) throw new Error(membersError.message)
  if (itemsError) throw new Error(itemsError.message)
  if (tasksError) throw new Error(tasksError.message)
  return {
    project: projectData,
    employees: employeesData || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members: (membersData as any) || [],
    items: itemsData || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: (tasksData as any) || [],
  }
}
