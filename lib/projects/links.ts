/**
 * Where a project or portfolio opens. The admin console and the staff pages
 * each have their own detail page; both read the same data, scoped by RLS.
 */

export function projectHref(projectId: string, isAdmin: boolean) {
  return `${isAdmin ? "/admin/project" : "/projects"}/${projectId}`
}

export function portfolioHref(portfolioId: string, isAdmin: boolean) {
  return `${isAdmin ? "/admin/portfolios" : "/portfolios"}/${portfolioId}`
}

export function projectsListHref(isAdmin: boolean) {
  return isAdmin ? "/admin/project" : "/projects"
}

export function portfoliosListHref(isAdmin: boolean) {
  return isAdmin ? "/admin/portfolios" : "/portfolios"
}
