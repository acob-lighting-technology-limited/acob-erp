import type { AdminRouteKeyV2 } from "@/lib/admin/policy-v2"

/** Plain-language names for the routes that have a separate edit level. */
export const EDIT_ROUTE_LABELS: Partial<Record<AdminRouteKeyV2, string>> = {
  "hr.main": "All of HR",
  "hr.leave": "HR: Leave",
  "hr.attendance": "HR: Attendance",
  "hr.pms": "HR: PMS",
  "hr.pms.cbt.manage": "HR: CBT management",
  "hr.fleet": "HR: Resource Booking",
  "jobdescriptions.main": "HR: Job Descriptions",
  "it.main": "All of IT",
  "security.networkActivity": "IT: Network Activity",
  "security.bypassOverride": "IT: Bypass & Override",
}

export function editRouteLabel(route: string): string {
  return EDIT_ROUTE_LABELS[route as AdminRouteKeyV2] ?? route
}
