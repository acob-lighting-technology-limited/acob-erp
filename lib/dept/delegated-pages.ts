/**
 * The pages a lead can hand to a delegate, and the rules for which URLs a delegation covers.
 * Everything not listed here is closed to a delegate: a page that is added to the console later
 * has to be added here before anyone can be given it.
 *
 * Console paths are relative to /dept/[id], for example "/hr/attendance".
 */
export interface DelegablePage {
  key: string
  label: string
  /** Sidebar group the page sits under. */
  group: string
  /** Page paths (and everything beneath them) this page covers. */
  paths: string[]
  /** API prefixes that belong to this page, so a call for another page is refused. */
  apis?: string[]
  /**
   * The /admin edit routes (admin_edit_grants) that cover the same work on the admin side. When the
   * lead can pass those on, delegating this page hands them over too, so one tick covers both places.
   */
  adminRoutes?: string[]
}

export const DEPT_DELEGABLE_PAGES: DelegablePage[] = [
  {
    key: "hr.employees",
    label: "Employees",
    group: "HR",
    paths: ["/hr/employees"],
    apis: ["/api/admin/hr/employees", "/api/v1/hr/employees", "/api/admin/hr/employment-categories"],
    adminRoutes: ["hr.employees"],
  },
  {
    key: "hr.attendance",
    label: "Attendance",
    group: "HR",
    paths: ["/hr/attendance"],
    apis: ["/api/admin/hr/attendance", "/api/hr/attendance"],
    adminRoutes: ["hr.attendance"],
  },
  {
    key: "hr.leave",
    label: "Leave",
    group: "HR",
    paths: ["/hr/leave"],
    apis: ["/api/admin/hr/leave", "/api/hr/leave"],
    adminRoutes: ["hr.leave"],
  },
  {
    key: "hr.offices",
    label: "Offices & Rooms",
    group: "HR",
    paths: ["/hr/offices-rooms"],
    apis: ["/api/admin/hr/office-locations"],
    adminRoutes: ["hr.offices"],
  },
  {
    key: "pms",
    label: "PMS",
    group: "PMS",
    paths: ["/pms"],
    apis: ["/api/admin/hr/performance"],
    adminRoutes: ["hr.pms", "hr.pms.cbt.manage"],
  },
  { key: "accounts.requisitions", label: "Requisitions", group: "Accounts", paths: ["/accounts/requisitions"] },
  { key: "accounts.assets", label: "Assets", group: "Accounts", paths: ["/assets"] },
  {
    key: "cs.scorecard",
    label: "Scorecard",
    group: "Corporate Services",
    paths: ["/corporate-services/scorecard"],
    adminRoutes: ["scorecard.main"],
  },
  {
    key: "cs.risk-register",
    label: "Risk Register",
    group: "Corporate Services",
    paths: ["/corporate-services/risk-register"],
    adminRoutes: ["scorecard.main"],
  },
  { key: "tasks", label: "Tasks", group: "Operations", paths: ["/tasks"] },
  { key: "help-desk", label: "Help Desk", group: "Operations", paths: ["/help-desk"] },
  { key: "reports", label: "Reports", group: "Operations", paths: ["/reports"] },
  { key: "correspondence", label: "Correspondence", group: "Operations", paths: ["/correspondence"] },
  { key: "communications", label: "Communications", group: "Operations", paths: ["/communications"] },
  { key: "documentation", label: "Documentation", group: "Operations", paths: ["/documentation"] },
  { key: "feedback", label: "Feedback", group: "Operations", paths: ["/feedback"] },
]

/**
 * Pages that exist only on the /admin side. A lead who owns them (Admin and HR, Corporate Services,
 * IT and Communications) can delegate them from the same dialog; ticking one hands over /admin edit
 * access on it. The key is the admin edit route.
 */
export interface AdminOnlyPage {
  key: string
  label: string
  group: string
}

export const ADMIN_ONLY_PAGES: AdminOnlyPage[] = [
  { key: "hr.departments", label: "Departments", group: "HR, admin side only" },
  { key: "jobdescriptions.main", label: "Job Descriptions", group: "HR, admin side only" },
  { key: "hr.lunch", label: "Lunch Register", group: "HR, admin side only" },
  { key: "hr.fleet", label: "Resource Booking", group: "HR, admin side only" },
  { key: "it.main", label: "IT pages (Mailboxes, Starlink, Onboarding, Mail)", group: "IT, admin side only" },
  { key: "security.networkActivity", label: "Network Activity", group: "IT, admin side only" },
  { key: "security.bypassOverride", label: "Bypass & Override", group: "IT, admin side only" },
  { key: "mddesk.main", label: "MD's Desk", group: "MD's Desk" },
]

export const CONSOLE_PAGE_KEYS = DEPT_DELEGABLE_PAGES.map((page) => page.key)
export const ADMIN_ONLY_PAGE_KEYS = ADMIN_ONLY_PAGES.map((page) => page.key)
/** Everything a delegation may name: console pages and admin-only pages. */
export const DEPT_DELEGABLE_PAGE_KEYS = [...CONSOLE_PAGE_KEYS, ...ADMIN_ONLY_PAGE_KEYS]

/** A delegation may last at most a year; it must always end. */
export const MAX_DEPT_DELEGATION_DAYS = 366

/** Only the keys that name a department console page; the rest are admin-side. */
export function consolePageKeys(pages: string[]): string[] {
  return pages.filter((key) => CONSOLE_PAGE_KEYS.includes(key))
}

/**
 * The /admin edit routes a set of ticked pages hands over, limited to what the lead can pass on
 * (`delegable`): the admin routes behind ticked console pages, plus any ticked admin-only page.
 */
export function adminRoutesForPages(pages: string[], delegable: string[]): string[] {
  const wanted = new Set<string>()
  for (const page of DEPT_DELEGABLE_PAGES) {
    if (pages.includes(page.key)) for (const route of page.adminRoutes ?? []) wanted.add(route)
  }
  for (const page of ADMIN_ONLY_PAGES) if (pages.includes(page.key)) wanted.add(page.key)
  return Array.from(wanted).filter((route) => delegable.includes(route))
}

function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** The path after /dept/[id] (or /api/dept/[id]); "" for the console root. */
export function deptRelativePath(pathname: string): string {
  const match = pathname.match(/^\/(?:api\/)?dept\/[^/]+(\/.*)?$/)
  const rest = match?.[1] ?? ""
  return rest.replace(/\/+$/, "")
}

/** The delegable page a console path belongs to, or null when it is not one of them. */
export function pageForDeptPath(relativePath: string): DelegablePage | null {
  return DEPT_DELEGABLE_PAGES.find((page) => page.paths.some((p) => matchesPrefix(relativePath, p))) ?? null
}

/** Whether a delegation holding `pages` may open this console path. The root and unknown paths are closed. */
export function isDeptPathAllowed(pages: string[], relativePath: string): boolean {
  const page = pageForDeptPath(relativePath)
  return page !== null && pages.includes(page.key)
}

/** Where a delegate lands: the first page they were given, in sidebar order. */
export function firstAllowedDeptPath(pages: string[]): string | null {
  const page = DEPT_DELEGABLE_PAGES.find((p) => pages.includes(p.key))
  return page ? page.paths[0] : null
}

/**
 * Whether a delegate may make this API call from the department console.
 *
 *  - A call whose path belongs to a known page is allowed only if that page was delegated.
 *  - Any other call is judged by the page it was made from (the Referer): it is allowed only
 *    when that page was delegated. A request with no usable page is refused.
 */
export function isDeptApiAllowed(pages: string[], apiPathname: string, refererPathname: string | null): boolean {
  const owner = DEPT_DELEGABLE_PAGES.find((page) => page.apis?.some((prefix) => matchesPrefix(apiPathname, prefix)))
  if (owner) return pages.includes(owner.key)
  if (!refererPathname) return false
  return isDeptPathAllowed(pages, deptRelativePath(refererPathname))
}
