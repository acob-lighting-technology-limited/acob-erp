/**
 * Where a project name links to: the admin project console from the admin
 * page, the staff projects page otherwise. Both tables read their search from
 * `?q=`, so the link lands filtered to that project.
 */
export function projectHref(projectName: string, isAdmin: boolean) {
  return `${isAdmin ? "/admin/project" : "/projects"}?q=${encodeURIComponent(projectName)}`
}
