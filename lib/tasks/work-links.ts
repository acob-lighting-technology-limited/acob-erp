import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * A task can be project work or portfolio work — never both. A project task
 * already belongs to its project's portfolio, so storing the portfolio as well
 * would let the two disagree once the project moves (enforced in the DB by
 * tasks_project_or_portfolio_check).
 */
export const WORK_LINK_CONFLICT = "Link a task to a project or to a portfolio, not both"

export function hasWorkLinkConflict(projectId: string | null | undefined, portfolioId: string | null | undefined) {
  return Boolean(projectId && portfolioId)
}

/** How a portfolio is labelled on a task: "MST — Minimum Subsidy Tender", or the name alone. */
export function portfolioLabel(portfolio: { name: string; code: string | null }) {
  return portfolio.code ? `${portfolio.code} — ${portfolio.name}` : portfolio.name
}

/** Names for the projects and portfolios a batch of tasks link to, read with the caller's (service) client. */
export async function loadWorkLinkNames(
  client: SupabaseClient,
  tasks: ReadonlyArray<{ project_id?: string | null; portfolio_id?: string | null }>
) {
  const projectIds = Array.from(new Set(tasks.map((t) => t.project_id).filter((id): id is string => Boolean(id))))
  const portfolioIds = Array.from(new Set(tasks.map((t) => t.portfolio_id).filter((id): id is string => Boolean(id))))

  const [projectsRes, portfoliosRes] = await Promise.all([
    projectIds.length > 0
      ? client.from("projects").select("id, project_name").in("id", projectIds)
      : Promise.resolve({ data: [] }),
    portfolioIds.length > 0
      ? client.from("portfolios").select("id, name, code").in("id", portfolioIds)
      : Promise.resolve({ data: [] }),
  ])

  const projectNames = new Map<string, string>(
    ((projectsRes.data || []) as Array<{ id: string; project_name: string }>).map((p) => [p.id, p.project_name])
  )
  const portfolioNames = new Map<string, string>(
    ((portfoliosRes.data || []) as Array<{ id: string; name: string; code: string | null }>).map((p) => [
      p.id,
      portfolioLabel(p),
    ])
  )
  return { projectNames, portfolioNames }
}

/** One task with its project_name and portfolio_name filled in. */
export async function withWorkLinkNames<T extends { project_id?: string | null; portfolio_id?: string | null }>(
  client: SupabaseClient,
  task: T
) {
  const { projectNames, portfolioNames } = await loadWorkLinkNames(client, [task])
  return {
    ...task,
    project_name: task.project_id ? (projectNames.get(task.project_id) ?? null) : null,
    portfolio_name: task.portfolio_id ? (portfolioNames.get(task.portfolio_id) ?? null) : null,
  }
}
