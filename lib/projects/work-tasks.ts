/**
 * The tasks tied to a project or a portfolio, as their pages' Tasks tabs and
 * the project plan board read them. Keys are shared so a task saved on the
 * plan board shows on the Tasks tab without a reload.
 */

export type WorkTask = {
  id: string
  title: string
  description?: string | null
  priority?: string | null
  status: string
  weight: number | null
  rating: number | null
  plan_id: string | null
  due_date: string | null
  task_start_date?: string | null
  task_end_date?: string | null
  work_item_number?: string | null
  assigned_to?: string | null
  department?: string | null
  goal_id?: string | null
  kpi_id?: string | null
  assignment_type?: "individual" | "multiple" | "department" | null
  is_archived: boolean | null
  assigned_user?: { first_name: string | null; last_name: string | null } | null
  project_id?: string | null
  /** Set on the portfolio Tasks tab; null there means the task is for the whole portfolio. */
  project?: { project_name: string } | null
}

export const projectTasksKey = (projectId: string) => ["project-tasks", projectId] as const
export const portfolioTasksKey = (portfolioId: string) => ["portfolio-tasks", portfolioId] as const

async function fetchTasks(url: string): Promise<WorkTask[]> {
  const res = await fetch(url, { cache: "no-store" })
  const payload = await res.json()
  if (!res.ok) throw new Error(payload?.error || "Failed to load tasks")
  return (payload?.data || []) as WorkTask[]
}

export const fetchProjectTasks = (projectId: string) => fetchTasks(`/api/projects/${projectId}/tasks`)
export const fetchPortfolioTasks = (portfolioId: string) => fetchTasks(`/api/portfolios/${portfolioId}/tasks`)
