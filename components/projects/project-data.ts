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
  const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as { error?: string; data?: ProjectPageData } | null
  if (!response.ok || !payload?.data) throw new Error(payload?.error || "Failed to fetch project detail")
  return payload.data
}
