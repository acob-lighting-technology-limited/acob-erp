/**
 * The project list as /api/projects returns it, and the shapes the Overview and
 * Charts components take — built in one place so the list, project and
 * portfolio pages cannot compute a project's progress differently.
 */

import { computeProjectHealth, type ProjectHealth, type ProjectHealthTask } from "@/lib/projects/health"
import type { ChartProject } from "@/lib/projects/charts"

export type ProjectRecord = {
  id: string
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w: number | null
  technology_type: string | null
  project_manager_id: string | null
  description: string | null
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled"
  created_at: string
  updated_at: string
  portfolio_id: string | null
  priority?: string | null
  project_manager?: {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
  } | null
  portfolio?: { id: string; name: string; code: string | null } | null
  tasks?: ProjectHealthTask[] | null
  plans?: { id: string }[] | null
}

/** Shared by every page that shows projects, so they share one cache entry. */
export const PROJECTS_QUERY_KEY = ["projects"] as const

export async function fetchProjectRecords(): Promise<ProjectRecord[]> {
  const res = await fetch("/api/projects", { cache: "no-store" })
  const payload = await res.json()
  if (!res.ok) throw new Error(payload?.error || `Failed to load projects (${res.status})`)
  return (payload?.data || []) as ProjectRecord[]
}

export function managerName(project: Pick<ProjectRecord, "project_manager">) {
  return (
    project.project_manager?.full_name ||
    [project.project_manager?.first_name, project.project_manager?.last_name].filter(Boolean).join(" ") ||
    "Unassigned"
  )
}

export function projectHealth(project: ProjectRecord, today: string): ProjectHealth {
  return computeProjectHealth({
    startDate: project.deployment_start_date,
    endDate: project.deployment_end_date,
    tasks: project.tasks || [],
    planIds: (project.plans || []).map((plan) => plan.id),
    today,
  })
}

export function toChartProject(project: ProjectRecord): ChartProject & { portfolioName: string | null } {
  return {
    id: project.id,
    project_name: project.project_name,
    portfolioId: project.portfolio?.id ?? null,
    portfolioName: project.portfolio?.name ?? null,
    startDate: project.deployment_start_date,
    endDate: project.deployment_end_date,
    tasks: project.tasks || [],
  }
}
