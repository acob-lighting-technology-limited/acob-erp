/**
 * Links inside views that are shared between the admin shell and the dept console.
 *
 * Many dept pages reuse admin views, and those views used to hard-code `/admin/…` links. A pure department
 * lead cannot open /admin (the admin layout sends them away), so such a link took them out of their console
 * or bounced them. These helpers rewrite a link into the shell the viewer is in, and say so when the dept
 * console has no matching page.
 */

/**
 * Every page in the dept console, as an admin-relative path ("" is the console's own home). It is checked
 * against the filesystem by lib/dept/__tests__/shell-links.test.ts, so it cannot drift from app/dept.
 */
export const DEPT_MIRRORED_PATHS: readonly string[] = [
  "",
  "/accounts",
  "/accounts/bills",
  "/accounts/invoices",
  "/accounts/payments",
  "/accounts/reports",
  "/accounts/requisitions",
  "/assets",
  "/assets/issues",
  "/communications",
  "/communications/broadcast",
  "/corporate-services",
  "/corporate-services/risk-register",
  "/corporate-services/scorecard",
  "/correspondence",
  "/documentation",
  "/documentation/department",
  "/documentation/personal",
  "/documentation/policies",
  "/documentation/sops",
  "/feedback",
  "/help-desk",
  "/hr",
  "/hr/attendance",
  "/hr/attendance/records",
  "/hr/departments",
  "/hr/employees",
  "/hr/leave",
  "/hr/offices-rooms",
  "/pms",
  "/pms/analytics",
  "/pms/attendance",
  "/pms/behaviour",
  "/pms/cbt",
  "/pms/cbt/question",
  "/pms/competencies",
  "/pms/cycles",
  "/pms/development-plans",
  "/pms/kpi",
  "/pms/peer-feedback",
  "/pms/reviews",
  "/pms/reviews/[cycleId]",
  "/reports",
  "/reports/weekly-reports",
  "/tasks",
]

export const ADMIN_BASE = "/admin"

const MIRRORED_PATTERNS = DEPT_MIRRORED_PATHS.map((p) => new RegExp(`^${p.replace(/\[[^\]]+\]/g, "[^/]+")}$`))

/** "/dept/<id>" when the pathname is inside a dept console, otherwise "/admin". */
export function shellBaseFromPathname(pathname: string | null | undefined): string {
  const match = (pathname ?? "").match(/^\/dept\/([^/]+)/)
  return match ? `/dept/${match[1]}` : ADMIN_BASE
}

const pathOnly = (href: string) => href.split(/[?#]/)[0].replace(/\/+$/, "")

/** Whether the dept console has a page at this admin-relative path (query and trailing slash ignored). */
export function isMirroredInDept(adminRelativePath: string): boolean {
  const path = pathOnly(adminRelativePath)
  return MIRRORED_PATTERNS.some((re) => re.test(path))
}

/**
 * Rewrites an `/admin/…` link into the current shell. In the admin shell it is returned unchanged. In a dept
 * console it becomes `/dept/<id>/…`, or `null` when the console has no such page, so the caller can leave
 * the link out. A link that does not start with /admin is returned unchanged.
 */
export function shellHref(href: string, base: string): string | null {
  if (
    base === ADMIN_BASE ||
    !(href === ADMIN_BASE || href.startsWith(`${ADMIN_BASE}/`) || href.startsWith(`${ADMIN_BASE}?`))
  ) {
    return href
  }
  const rest = href.slice(ADMIN_BASE.length)
  return isMirroredInDept(rest) ? `${base}${rest}` : null
}

/**
 * Like `shellHref`, for a "Back to …" link: when the exact page has no dept mirror it falls back to the
 * nearest ancestor that does, ending at the console's home, so a back link never disappears or dead-ends.
 */
export function shellBackHref(href: string, base: string): string {
  const direct = shellHref(href, base)
  if (direct) return direct
  const segments = pathOnly(href.slice(ADMIN_BASE.length)).split("/").filter(Boolean)
  while (segments.length > 0) {
    segments.pop()
    const candidate = segments.length ? `/${segments.join("/")}` : ""
    if (isMirroredInDept(candidate)) return `${base}${candidate}`
  }
  return base
}
