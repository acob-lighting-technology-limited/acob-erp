import {
  DEPT_ADMIN_HR,
  DEPT_CORPORATE_SERVICES,
  DEPT_ITC,
  isSameDepartment,
  normalizeDepartmentName,
} from "@/shared/departments"

export type AdminDomain = "hr" | "finance" | "assets" | "reports" | "tasks" | "projects" | "communications"

export interface AccessScopeInputV2 {
  role: string
  isDepartmentLead: boolean
  isAdminLike: boolean
  adminRoutes: AdminRouteKeyV2[] | null
  scopeMode: "global" | "lead"
  managedDepartments: string[]
  /** The person's own department; used with isDepartmentLead when lead_departments is empty. */
  department?: string | null
  /** profiles.lead_departments. */
  leadDepartments?: string[]
  /** Active edit grants / delegations (admin_edit_grants), already filtered for expiry. */
  editRoutes?: AdminRouteKeyV2[]
  /** The subset of editRoutes that are standing overrides rather than a delegation. */
  editOverrideRoutes?: AdminRouteKeyV2[]
  /** For delegated routes, who lent them (route key to the owner's user id). */
  editDelegators?: Record<string, string>
  /** Guarded areas this person owns (edit_area_owners). */
  ownedAreas?: string[]
}

export type ActingContextV2 = "global_admin" | "department_lead"
export type RouteVisibilityV2 = "none" | "dept" | "global_view"
export type RouteMutationsV2 = "none" | "dept" | "global"
export type DataScopeV2 = "none" | "all" | string[]

export type AdminRouteKeyV2 =
  | "admin.dashboard"
  | "auditlogs.main"
  | "assets.main"
  | "assets.issues"
  | "accounts.main"
  | "communications.main"
  | "communications.broadcast"
  | "communications.meetings"
  | "correspondence.main"
  | "dev.main"
  | "documentation.main"
  | "events.main"
  | "mddesk.main"
  | "feedback.main"
  | "finance.main"
  | "helpdesk.main"
  | "hr.main"
  | "hr.employees"
  | "hr.departments"
  | "hr.lunch"
  | "hr.offices"
  | "hr.fleet"
  | "hr.resources"
  | "hr.leave"
  | "hr.attendance"
  | "hr.pms"
  | "hr.pms.cbt.manage"
  | "inventory.main"
  | "it.main"
  | "jobdescriptions.main"
  | "notifications.main"
  | "payroll.main"
  | "portfolios.main"
  | "projects.main"
  | "purchasing.main"
  | "reports.weekly"
  | "reports.other"
  | "scorecard.main"
  | "security.networkActivity"
  | "security.bypassOverride"
  | "settings.main"
  | "tasks.main"
  | "tools.main"
  | "versionhistory.main"
  | "unknown"

/**
 * Routes that can be explicitly granted to an admin user. Excludes system-only
 * routes, and routes no pathname ever resolves to.
 *
 * "hr.resources" and "finance.main" are deliberately absent: resolveAdminRouteKeyV2
 * maps /admin/hr/resources to "hr.fleet" and /admin/finance to "accounts.main",
 * so neither key was ever produced by a request. Granting one did nothing on its
 * own. Both remain in AdminRouteKeyV2 and are still honoured as alternatives in
 * canAccessRouteV2, so any grant made before this change keeps working.
 */
export const GRANTABLE_ADMIN_ROUTES: AdminRouteKeyV2[] = [
  "hr.main",
  "hr.fleet",
  "hr.leave",
  "hr.attendance",
  "hr.pms",
  "hr.pms.cbt.manage",
  "jobdescriptions.main",
  "accounts.main",
  "payroll.main",
  "purchasing.main",
  "assets.main",
  "assets.issues",
  "inventory.main",
  "it.main",
  "reports.weekly",
  "reports.other",
  "scorecard.main",
  "portfolios.main",
  "projects.main",
  "tasks.main",
  "communications.main",
  "communications.broadcast",
  "communications.meetings",
  "correspondence.main",
  "documentation.main",
  "events.main",
  "feedback.main",
  "helpdesk.main",
  "notifications.main",
  "tools.main",
  "settings.main",
  "auditlogs.main",
  "security.networkActivity",
  "security.bypassOverride",
]

export interface AccessContextV2 {
  baseRole: string
  isDepartmentLead: boolean
  isAdminLike: boolean
  adminRoutes: AdminRouteKeyV2[] | null
  actingContext: ActingContextV2
  managedDepartments: string[]
  /** Departments this person leads (lead_departments, or their own department for a lead). */
  ledDepartments?: string[]
  /** Active edit grants / delegations on the edit-guarded routes. */
  editRoutes?: AdminRouteKeyV2[]
  /** The subset of editRoutes that are standing overrides (no delegator), not someone acting for an owner. */
  editOverrideRoutes?: AdminRouteKeyV2[]
  /** For delegated routes, who lent them (route key to the owner's user id). */
  editDelegators?: Record<string, string>
  /** The guarded areas this person owns (edit_area_owners). */
  ownedAreas?: string[]
}

/**
 * Routes with separate VIEW and EDIT levels. Everything else is still all-or-nothing:
 * whoever can open it can change it.
 *
 * VIEW is the usual route grant. EDIT is held by the lead(s) of the owning
 * department(s) below, or by an explicit grant / delegation (admin_edit_grants).
 * Developers and super admins view every route but get no automatic edit here.
 */
export const HR_EDIT_ROUTES: AdminRouteKeyV2[] = [
  "hr.main",
  "hr.employees",
  "hr.departments",
  "hr.lunch",
  "hr.offices",
  "hr.fleet",
  "hr.resources",
  "hr.leave",
  "hr.attendance",
  "hr.pms",
  "hr.pms.cbt.manage",
  "jobdescriptions.main",
]
export const IT_EDIT_ROUTES: AdminRouteKeyV2[] = ["it.main", "security.networkActivity", "security.bypassOverride"]
export const CS_EDIT_ROUTES: AdminRouteKeyV2[] = ["scorecard.main"]
export const MD_EDIT_ROUTES: AdminRouteKeyV2[] = ["mddesk.main"]
export const EDIT_GUARDED_ROUTES: AdminRouteKeyV2[] = [
  ...HR_EDIT_ROUTES,
  ...IT_EDIT_ROUTES,
  ...CS_EDIT_ROUTES,
  ...MD_EDIT_ROUTES,
]

/** The guarded areas. Each has owners (edit_area_owners) who decide who may change things there. */
export type EditArea = "hr" | "it" | "corporate_services" | "md_desk"
export const EDIT_AREAS: EditArea[] = ["hr", "it", "corporate_services", "md_desk"]
export const EDIT_AREA_LABELS: Record<EditArea, string> = {
  hr: "HR",
  it: "IT",
  corporate_services: "Corporate Services",
  md_desk: "MD's Desk",
}

/** Departments whose leads may only be changed by a developer or super admin (they hold appeal approvals). */
export const EDIT_OWNER_DEPARTMENTS = {
  hr: [DEPT_ADMIN_HR, DEPT_CORPORATE_SERVICES],
  it: [DEPT_ITC],
} as const

/** Route keys an edit grant may be written for (mirrors admin_edit_grants_route_key_check). */
export const GRANTABLE_EDIT_ROUTES: AdminRouteKeyV2[] = [
  "hr.main",
  "hr.employees",
  "hr.departments",
  "hr.lunch",
  "hr.offices",
  "hr.fleet",
  "hr.leave",
  "hr.attendance",
  "hr.pms",
  "hr.pms.cbt.manage",
  "jobdescriptions.main",
  "it.main",
  "security.networkActivity",
  "security.bypassOverride",
  "scorecard.main",
  "mddesk.main",
]

export function isEditGuardedRoute(route: AdminRouteKeyV2): boolean {
  return EDIT_GUARDED_ROUTES.includes(route)
}

/** The guarded area a route belongs to, or null for an unguarded route. */
export function editAreaFor(route: AdminRouteKeyV2): EditArea | null {
  if (HR_EDIT_ROUTES.includes(route)) return "hr"
  if (IT_EDIT_ROUTES.includes(route)) return "it"
  if (CS_EDIT_ROUTES.includes(route)) return "corporate_services"
  if (MD_EDIT_ROUTES.includes(route)) return "md_desk"
  return null
}

export interface RoutePolicyV2 {
  visibility: RouteVisibilityV2
  mutations: RouteMutationsV2
  adminOnly: boolean
  domain: AdminDomain | null
}

export function isRbacV2Enabled() {
  return String(process.env.RBAC_V2_ENABLED || "true").toLowerCase() !== "false"
}

function normalizeRole(role: string | null | undefined) {
  return String(role || "")
    .trim()
    .toLowerCase()
}

function normalizeDepartmentList(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeDepartmentName(String(value || ""))).filter(Boolean)))
}

export function buildAccessContextV2(scope: AccessScopeInputV2): AccessContextV2 {
  const baseRole = normalizeRole(scope.role)
  const isAdminLike = scope.isAdminLike || ["developer", "super_admin", "admin"].includes(baseRole)
  const actingContext: ActingContextV2 =
    scope.scopeMode === "lead" || (!isAdminLike && scope.isDepartmentLead) ? "department_lead" : "global_admin"

  const explicitLed = normalizeDepartmentList(scope.leadDepartments ?? [])
  const ledDepartments = !scope.isDepartmentLead
    ? []
    : explicitLed.length > 0
      ? explicitLed
      : normalizeDepartmentList(scope.department ? [scope.department] : [])

  return {
    baseRole,
    isDepartmentLead: scope.isDepartmentLead,
    isAdminLike,
    adminRoutes: scope.adminRoutes,
    actingContext,
    managedDepartments: normalizeDepartmentList(scope.managedDepartments || []),
    ledDepartments,
    editRoutes: scope.editRoutes ?? [],
    editOverrideRoutes: scope.editOverrideRoutes ?? [],
    editDelegators: scope.editDelegators ?? {},
    ownedAreas: scope.ownedAreas ?? [],
  }
}

export function resolveAdminRouteKeyV2(pathname: string): AdminRouteKeyV2 {
  if (!pathname.startsWith("/admin")) return "unknown"
  if (pathname === "/admin") return "admin.dashboard"
  if (pathname.startsWith("/admin/audit-logs")) return "auditlogs.main"
  if (pathname.startsWith("/admin/dev")) return "dev.main"
  // The IT console. Onboarding, Mailboxes, Starlink and Mail settings are IT's, so
  // they gate on it.main (owned by the IT and Communications lead). Both the old
  // and the /admin/it/* paths resolve here: the old ones are redirected in
  // next.config.mjs, and resolving them identically is defence in depth. These must
  // stay above the /admin/settings and /admin/accounts rules below.
  // Network Activity and Bypass & Override keep their own grants inside the IT console.
  // Attendance and CBT settings moved out of /admin/settings onto their HR pages.
  if (pathname.startsWith("/admin/hr/attendance/settings")) return "hr.attendance"
  if (pathname.startsWith("/admin/settings/attendance")) return "hr.attendance"
  if (pathname.startsWith("/admin/hr/pms/cbt/settings")) return "hr.pms.cbt.manage"
  if (pathname.startsWith("/admin/pms/cbt/settings")) return "hr.pms.cbt.manage"
  if (pathname.startsWith("/admin/settings/cbt")) return "hr.pms.cbt.manage"
  if (pathname.startsWith("/admin/it/network-activity")) return "security.networkActivity"
  if (pathname.startsWith("/admin/it/bypass-override")) return "security.bypassOverride"
  if (pathname.startsWith("/admin/it")) return "it.main"
  if (pathname.startsWith("/admin/onboarding")) return "it.main"
  if (pathname.startsWith("/admin/settings/mailboxes")) return "it.main"
  if (pathname.startsWith("/admin/settings/mail")) return "it.main"
  if (pathname.startsWith("/admin/accounts/starlink")) return "it.main"
  // Payroll, Inventory and Assets moved under /admin/accounts but keep their own keys. These
  // must stay above the /admin/accounts rule below; the old top-level paths resolve the same.
  if (pathname.startsWith("/admin/accounts/payroll")) return "payroll.main"
  if (pathname.startsWith("/admin/accounts/inventory")) return "inventory.main"
  if (pathname.startsWith("/admin/accounts/assets/issues")) return "assets.issues"
  if (pathname.startsWith("/admin/accounts/assets")) return "assets.main"
  if (pathname.startsWith("/admin/settings")) return "settings.main"
  if (pathname.startsWith("/admin/communications/meetings")) return "communications.meetings"
  if (pathname.startsWith("/admin/communications/broadcast")) return "communications.broadcast"
  if (pathname.startsWith("/admin/communications")) return "communications.main"
  if (pathname.startsWith("/admin/assets/issues")) return "assets.issues"
  if (pathname.startsWith("/admin/assets")) return "assets.main"
  if (pathname.startsWith("/admin/correspondence")) return "correspondence.main"
  if (pathname.startsWith("/admin/documentation")) return "documentation.main"
  if (pathname.startsWith("/admin/events")) return "events.main"
  if (pathname.startsWith("/admin/md-desk")) return "mddesk.main"
  if (pathname.startsWith("/admin/feedback")) return "feedback.main"
  if (pathname.startsWith("/admin/accounts")) return "accounts.main"
  if (pathname.startsWith("/admin/finance")) return "accounts.main"
  if (pathname.startsWith("/admin/help-desk")) return "helpdesk.main"
  // Payroll owns its own key. The two legacy HR paths still resolve here so the
  // redirects behave identically to the new /admin/payroll route — this must
  // stay above the /admin/hr fallthrough below.
  if (pathname.startsWith("/admin/payroll")) return "payroll.main"
  if (pathname.startsWith("/admin/hr/payroll")) return "payroll.main"
  if (pathname.startsWith("/admin/hr/employees/payroll")) return "payroll.main"
  // Must stay above the /admin/hr fallthrough below.
  if (pathname.startsWith("/admin/hr/job-descriptions")) return "jobdescriptions.main"
  // PMS lives under HR at /admin/hr/pms. The /admin/pms paths are the short-lived
  // own-console URLs, redirected in next.config.mjs, and resolve identically as
  // defence in depth. Both must stay above the /admin/hr fallthrough below.
  if (pathname.startsWith("/admin/pms/cbt/question")) return "hr.pms.cbt.manage"
  if (pathname.startsWith("/admin/hr/pms/cbt/question")) return "hr.pms.cbt.manage"
  if (/^\/admin\/(?:hr\/)?pms\/cbt\/[^/]+$/.test(pathname)) return "hr.pms.cbt.manage"
  if (pathname.startsWith("/admin/pms")) return "hr.pms"
  if (pathname.startsWith("/admin/hr/pms")) return "hr.pms"
  if (pathname.startsWith("/admin/hr/leave")) return "hr.leave"
  if (pathname.startsWith("/admin/hr/attendance")) return "hr.attendance"
  // Pre-rename path. It is redirected in next.config.mjs before middleware ever
  // sees it, so this is defence in depth: if that redirect is ever dropped, the
  // path still gates as attendance rather than falling through to hr.main.
  if (pathname.startsWith("/admin/hr/employees/attendance")) return "hr.attendance"
  // Fleet and Resources are the same "Resource Booking" feature — both gate on hr.fleet.
  if (pathname.startsWith("/admin/hr/fleet")) return "hr.fleet"
  if (pathname.startsWith("/admin/hr/resources")) return "hr.fleet"
  if (pathname.startsWith("/admin/hr")) return "hr.main"
  if (pathname.startsWith("/admin/inventory")) return "inventory.main"
  if (pathname.startsWith("/admin/job-descriptions")) return "jobdescriptions.main"
  if (pathname.startsWith("/admin/notifications")) return "notifications.main"
  if (pathname.startsWith("/admin/purchasing")) return "purchasing.main"
  if (pathname.startsWith("/admin/corporate-scorecard") || pathname.startsWith("/admin/corporate-services"))
    return "scorecard.main"
  if (pathname.startsWith("/admin/portfolios")) return "portfolios.main"
  // Matches /admin/projects and the legacy singular /admin/project stub. Must
  // stay below the /admin/portfolios rule above, which it would not shadow but
  // reads more clearly in that order.
  if (pathname.startsWith("/admin/project")) return "projects.main"
  if (pathname.startsWith("/admin/security/bypass-override")) return "security.bypassOverride"
  if (pathname.startsWith("/admin/security/network-activity")) return "security.networkActivity"
  // Group root, redirects to the audit log — gate it as the page it lands on.
  if (pathname.startsWith("/admin/security")) return "auditlogs.main"
  if (pathname.startsWith("/admin/reports")) {
    if (pathname.includes("/weekly-reports")) return "reports.weekly"
    return "reports.other"
  }
  if (pathname.startsWith("/admin/tasks")) return "tasks.main"
  if (pathname.startsWith("/admin/tools")) return "tools.main"
  if (pathname.startsWith("/admin/version-history")) return "versionhistory.main"
  return "unknown"
}

export function getRoutePolicyV2(route: AdminRouteKeyV2): RoutePolicyV2 {
  switch (route) {
    case "dev.main":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
    case "auditlogs.main":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
    case "settings.main":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
    case "it.main":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
    case "security.networkActivity":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
    case "security.bypassOverride":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
    case "communications.meetings":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: "communications" }
    case "payroll.main":
      // Salary data spans the whole org and the pages already require isAdminLike,
      // so department leads never see it — adminOnly matches the runtime guard.
      return { visibility: "none", mutations: "none", adminOnly: true, domain: "finance" }
    case "hr.fleet":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: "hr" }
    case "hr.resources":
      return { visibility: "none", mutations: "none", adminOnly: true, domain: "hr" }
    case "hr.pms.cbt.manage":
      // Department leads set their own team's CBT from /dept/[id]/pms/cbt —
      // they own the assessment for their department, so this is dept-scoped
      // rather than admin-only. Global admins still reach it via PMS/HR grants.
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "hr" }
    case "hr.pms":
    case "hr.leave":
    case "hr.attendance":
    case "hr.employees":
    case "hr.departments":
    case "hr.lunch":
    case "hr.offices":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "hr" }
    case "reports.weekly":
      return { visibility: "global_view", mutations: "dept", adminOnly: false, domain: "reports" }
    case "reports.other":
      return { visibility: "global_view", mutations: "none", adminOnly: false, domain: "reports" }
    case "admin.dashboard":
      return { visibility: "dept", mutations: "none", adminOnly: false, domain: null }
    case "assets.main":
    case "assets.issues":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "assets" }
    case "communications.main":
    case "communications.broadcast":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "correspondence.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "documentation.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "mddesk.main":
      // MD's Desk is membership-gated (the MD + md_desk_delegates), not grant-gated:
      // the page and sidebar check is_md_desk_member, and RLS guards the data.
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "events.main":
      // Company events. Department leads manage their own team's events here;
      // what each person may actually see or edit is enforced by RLS on events.
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "feedback.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "accounts.main":
    case "finance.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "finance" }
    case "helpdesk.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "hr.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "hr" }
    case "inventory.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "assets" }
    case "jobdescriptions.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "hr" }
    case "notifications.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "purchasing.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "finance" }
    case "tasks.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "tasks" }
    case "portfolios.main":
    case "projects.main":
      // Company-wide registers with no dept-scoped variant — the dept console
      // has no Portfolios/Projects surface, so these are admin-only and reached
      // through an explicit grant.
      return { visibility: "none", mutations: "global", adminOnly: true, domain: "projects" }
    case "scorecard.main":
      // The corporate scorecard is the company-wide objective register. Its
      // department cascade is authored here by global admins; leads consume the
      // cascade from their own console, not from /admin.
      return { visibility: "none", mutations: "global", adminOnly: true, domain: "reports" }
    case "tools.main":
      return { visibility: "dept", mutations: "dept", adminOnly: false, domain: "communications" }
    case "versionhistory.main":
      // Release notes for the whole platform: readable by every admin-like
      // role, not grantable, and not part of the department-lead console.
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
    case "unknown":
    default:
      // Deny by default. A new /admin/* section with no resolver branch lands
      // here, and an unrecognised route must never be reachable — previously
      // this defaulted to dept-visible, which silently exposed ungated pages
      // (Portfolios, Projects, Corporate Scorecard) to department leads.
      return { visibility: "none", mutations: "none", adminOnly: true, domain: null }
  }
}

function adminHasRoute(context: AccessContextV2, route: AdminRouteKeyV2): boolean {
  if (context.baseRole === "developer" || context.baseRole === "super_admin") return true
  if (context.baseRole !== "admin") return false
  return Array.isArray(context.adminRoutes) && context.adminRoutes.includes(route)
}

function isDepartmentManaged(context: AccessContextV2, department: string) {
  const normalizedDepartment = normalizeDepartmentName(department)
  return context.managedDepartments.includes(normalizedDepartment)
}

export function canAccessRouteV2(context: AccessContextV2, route: AdminRouteKeyV2): boolean {
  const policy = getRoutePolicyV2(route)
  const isGlobalAdminContext = context.actingContext === "global_admin" && context.isAdminLike

  if (isGlobalAdminContext) {
    // Dev tooling is developer-only (matches canAccessAdminSection). super_admin
    // and admin never see /admin/dev, regardless of granted routes.
    if (route === "dev.main") {
      return context.baseRole === "developer"
    }
    // Dashboard is always accessible to any admin-like role
    if (route === "admin.dashboard") return true
    // Membership-gated, not grantable — see getRoutePolicyV2("mddesk.main").
    if (route === "mddesk.main") return true
    // Read-only release notes — see getRoutePolicyV2("versionhistory.main").
    if (route === "versionhistory.main") return true
    // Accounts and Finance map to each other so existing grants stay valid
    if (route === "accounts.main" || route === "finance.main") {
      return adminHasRoute(context, "accounts.main") || adminHasRoute(context, "finance.main")
    }
    // Leave, Attendance, Resource Booking (Fleet/Resources) and PMS are grantable
    // on their own, but full "Employees & HR" (hr.main) also includes them — so
    // admins who already had HR keep access (no lockout). CBT folds into PMS.
    // Edit-only areas of the HR pages: viewing them is part of hr.main.
    if (route === "hr.employees" || route === "hr.departments" || route === "hr.lunch" || route === "hr.offices") {
      return adminHasRoute(context, "hr.main")
    }
    if (route === "hr.leave") {
      return adminHasRoute(context, "hr.leave") || adminHasRoute(context, "hr.main")
    }
    if (route === "hr.attendance") {
      return adminHasRoute(context, "hr.attendance") || adminHasRoute(context, "hr.main")
    }
    if (route === "hr.fleet" || route === "hr.resources") {
      return (
        adminHasRoute(context, "hr.fleet") ||
        adminHasRoute(context, "hr.resources") ||
        adminHasRoute(context, "hr.main")
      )
    }
    if (route === "hr.pms") {
      return adminHasRoute(context, "hr.pms") || adminHasRoute(context, "hr.main")
    }
    // Payroll moved out of HR into Accounts and gained its own key. Admins who
    // already held full HR keep access so the split is not a lockout.
    if (route === "payroll.main") {
      return adminHasRoute(context, "payroll.main") || adminHasRoute(context, "hr.main")
    }
    if (route === "hr.pms.cbt.manage") {
      // CBT is part of PMS now — granting PMS (or full HR) covers it.
      return (
        adminHasRoute(context, "hr.pms.cbt.manage") ||
        adminHasRoute(context, "hr.pms") ||
        adminHasRoute(context, "hr.main")
      )
    }
    // Everything else — including Settings and Audit Logs — is assignment-driven:
    //   - developer / super_admin: full access (adminHasRoute returns true)
    //   - admin: only routes explicitly granted to them (admin_routes)
    // i.e. an admin is a super_admin scoped to their assigned routes.
    return adminHasRoute(context, route)
  }

  if (!context.isDepartmentLead) return false
  if (policy.adminOnly) return false
  return policy.visibility !== "none"
}

/** The umbrella key whose grant covers a whole edit-guarded group (hr.main, it.main). */
function editUmbrellaFor(route: AdminRouteKeyV2): AdminRouteKeyV2 | null {
  if (HR_EDIT_ROUTES.includes(route)) return "hr.main"
  if (IT_EDIT_ROUTES.includes(route)) return "it.main"
  if (CS_EDIT_ROUTES.includes(route)) return "scorecard.main"
  if (MD_EDIT_ROUTES.includes(route)) return "mddesk.main"
  return null
}

/** Owns the area this route belongs to (edit_area_owners). Never inferred from who leads a department. */
export function isEditOwnerV2(context: AccessContextV2, route: AdminRouteKeyV2): boolean {
  const area = editAreaFor(route)
  return area !== null && (context.ownedAreas ?? []).includes(area)
}

/** Who lent this person edit on the route (or its umbrella), when they are acting for an owner. */
export function editDelegatorV2(context: AccessContextV2, route: AdminRouteKeyV2): string | null {
  const map = context.editDelegators ?? {}
  const umbrella = editUmbrellaFor(route)
  return map[route] ?? (umbrella ? (map[umbrella] ?? null) : null)
}

/** How a person is allowed to change things on a route: as its owner, for the owner, or as an override. */
export type EditModeV2 = "owner" | "delegate" | "override"

export function editModeV2(context: AccessContextV2, route: AdminRouteKeyV2): EditModeV2 | null {
  if (!canEditRouteV2(context, route)) return null
  if (!isEditGuardedRoute(route)) return null
  if (isEditOwnerV2(context, route)) return "owner"
  const umbrella = editUmbrellaFor(route)
  const covers = (list: AdminRouteKeyV2[] | undefined) =>
    (list ?? []).includes(route) || (umbrella !== null && (list ?? []).includes(umbrella))
  // Acting for an owner wins over an override held at the same time.
  const viaDelegation = (context.editRoutes ?? []).filter((key) => !(context.editOverrideRoutes ?? []).includes(key))
  if (covers(viaDelegation)) return "delegate"
  return covers(context.editOverrideRoutes) ? "override" : null
}

/**
 * Whether the context may CHANGE things on `route` (view is canAccessRouteV2).
 *
 * Routes without an edit level behave as before: viewing implies editing. On the
 * HR and IT routes edit needs to be one of:
 *   - an owner of the area (edit_area_owners),
 *   - an active edit grant or delegation on the route, or on its group's umbrella
 *     key (hr.main / it.main / scorecard.main).
 * Admin, super_admin and developer get no automatic edit there, only view.
 */
export function canEditRouteV2(context: AccessContextV2, route: AdminRouteKeyV2): boolean {
  if (!canAccessRouteV2(context, route)) return false
  if (!isEditGuardedRoute(route)) return true
  // Department-console callers are governed by their lead scope, not by /admin edit.
  if (context.actingContext !== "global_admin" || !context.isAdminLike) return false
  if (isEditOwnerV2(context, route)) return true
  const umbrella = editUmbrellaFor(route)
  const granted = context.editRoutes ?? []
  return granted.includes(route) || (umbrella !== null && granted.includes(umbrella))
}

/**
 * The edit-guarded route key a mutating /api request belongs to, or null when the
 * request is not covered by the central edit check (reads, unguarded sections, and
 * the routes that enforce their own rules — attendance appeals are approved by
 * stage, not by page edit).
 */
export function resolveApiEditRouteKeyV2(pathname: string): AdminRouteKeyV2 | null {
  const p = pathname.replace(/\/+$/, "")
  if (p.startsWith("/api/admin/hr/attendance/appeals")) return null
  // Naming department leads is role management (Settings > Roles), checked by its own route.
  if (p.startsWith("/api/admin/hr/department-leads")) return null
  if (p.startsWith("/api/admin/mailboxes")) return "it.main"
  if (p.startsWith("/api/admin/onboarding")) return "it.main"
  if (p.startsWith("/api/admin/settings/mail")) return "it.main"
  if (p.startsWith("/api/starlink")) return "it.main"
  if (p.startsWith("/api/admin/security/network-activity")) return "security.networkActivity"
  if (p.startsWith("/api/admin/settings/attendance")) return "hr.attendance"
  if (p.startsWith("/api/admin/settings/cbt")) return "hr.pms.cbt.manage"
  if (p.startsWith("/api/admin/hr/attendance")) return "hr.attendance"
  if (p.startsWith("/api/admin/hr/leave")) return "hr.leave"
  if (p.startsWith("/api/admin/hr/lunch")) return "hr.lunch"
  if (p.startsWith("/api/admin/hr/departments")) return "hr.departments"
  if (p.startsWith("/api/admin/hr/office-locations")) return "hr.offices"
  if (p.startsWith("/api/admin/hr/employees") || p.startsWith("/api/admin/hr/employment-categories"))
    return "hr.employees"
  if (p.startsWith("/api/admin/hr/birthdays")) return "hr.employees"
  if (p.startsWith("/api/admin/hr/performance/cbt")) return "hr.pms.cbt.manage"
  if (p.startsWith("/api/admin/hr/performance")) return "hr.pms"
  if (p.startsWith("/api/admin/hr/fleet")) return "hr.fleet"
  if (p.startsWith("/api/admin/job-descriptions")) return "jobdescriptions.main"
  if (p.startsWith("/api/admin/hr")) return "hr.main"
  // Corporate Services management. Staff also read the scorecard from their KPI page, so only the
  // management endpoints are guarded; entering actuals is left to its own rules.
  const scorecardManagement = ["kpis", "assignments", "goals", "register", "departments"]
  if (
    scorecardManagement.some(
      (name) => p === `/api/corporate-scorecard/${name}` || p.startsWith(`/api/corporate-scorecard/${name}/`)
    )
  ) {
    return "scorecard.main"
  }
  if (p.startsWith("/api/corporate-services")) return "scorecard.main"
  // MD's Desk: the database decides who can write its data; this stops everyone else at the door.
  if (p.startsWith("/api/md-desk")) return "mddesk.main"
  return null
}

export function getDataScopeV2(context: AccessContextV2, route: AdminRouteKeyV2): DataScopeV2 {
  if (!canAccessRouteV2(context, route)) return "none"

  const policy = getRoutePolicyV2(route)
  const isGlobalAdminContext = context.actingContext === "global_admin" && context.isAdminLike
  if (isGlobalAdminContext) return "all"

  if (policy.visibility === "global_view") return "all"
  if (policy.visibility === "dept") return context.managedDepartments
  return "none"
}

export function canMutateV2(
  context: AccessContextV2,
  route: AdminRouteKeyV2,
  resourceDepartment?: string | null
): boolean {
  if (!canAccessRouteV2(context, route)) return false

  const policy = getRoutePolicyV2(route)
  const isGlobalAdminContext = context.actingContext === "global_admin" && context.isAdminLike
  if (isGlobalAdminContext) {
    // reports.other has mutations:"none" in policy but admin access implies write access
    if (route === "reports.other") return true
    return policy.mutations !== "none"
  }

  if (policy.adminOnly || policy.mutations === "none") return false
  if (policy.mutations === "global") return true

  if (policy.mutations === "dept") {
    if (!resourceDepartment) return false
    return isDepartmentManaged(context, resourceDepartment)
  }

  return false
}

export function applyDataScopeV2<T>(rows: T[], scope: DataScopeV2, getDepartment: (row: T) => string | null): T[] {
  if (scope === "all") return rows
  if (scope === "none") return []
  if (scope.length === 0) return []

  return rows.filter((row) => {
    const department = getDepartment(row)
    if (!department) return false
    const normalizedDepartment = normalizeDepartmentName(department)
    return scope.includes(normalizedDepartment)
  })
}
