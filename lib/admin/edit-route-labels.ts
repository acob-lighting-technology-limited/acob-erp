import type { AdminRouteKeyV2 } from "@/lib/admin/policy-v2"

/** Plain-language names for the routes that have a separate edit level. */
export const EDIT_ROUTE_LABELS: Partial<Record<AdminRouteKeyV2, string>> = {
  "hr.main": "Everything in HR",
  "hr.employees": "Employees",
  "hr.departments": "Departments",
  "hr.lunch": "Lunch Register",
  "hr.offices": "Offices & Rooms",
  "hr.leave": "Leave",
  "hr.attendance": "Attendance",
  "hr.pms": "PMS",
  "hr.pms.cbt.manage": "CBT management",
  "hr.fleet": "Resource Booking",
  "jobdescriptions.main": "Job Descriptions",
  "it.main": "Everything in IT",
  "security.networkActivity": "Network Activity",
  "security.bypassOverride": "Bypass & Override",
}

export function editRouteLabel(route: string): string {
  return EDIT_ROUTE_LABELS[route as AdminRouteKeyV2] ?? route
}

/** Which guarded group a route belongs to. */
export function editRouteGroup(route: string): "hr" | "it" {
  return route === "it.main" || route.startsWith("it.") || route.startsWith("security.") ? "it" : "hr"
}

/** The group's "everything" key. */
export const EDIT_GROUP_UMBRELLA = { hr: "hr.main", it: "it.main" } as const

/** Pages in the order they appear in the sidebar, so a list of them reads like the menu. */
const EDIT_ROUTE_ORDER = [
  "hr.employees",
  "hr.departments",
  "jobdescriptions.main",
  "hr.attendance",
  "hr.leave",
  "hr.lunch",
  "hr.fleet",
  "hr.offices",
  "hr.pms",
  "hr.pms.cbt.manage",
  "security.networkActivity",
  "security.bypassOverride",
]

export function sortEditRoutes(routes: string[]): string[] {
  const rank = (route: string) => {
    const index = EDIT_ROUTE_ORDER.indexOf(route)
    return index === -1 ? EDIT_ROUTE_ORDER.length : index
  }
  return [...routes].sort((a, b) => rank(a) - rank(b))
}
