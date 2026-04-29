import type { AdminDomain, AdminScopeMode } from "@/lib/admin/rbac"
import {
  buildAccessContextV2,
  canAccessRouteV2,
  resolveAdminRouteKeyV2,
  type AccessContextV2,
} from "@/lib/admin/policy-v2"

export interface AdminAccessScope {
  role: string | null | undefined
  isDepartmentLead: boolean
  isAdminLike: boolean
  adminDomains: AdminDomain[] | null
  scopeMode: AdminScopeMode
}

export function getDomainForAdminPath(path: string): AdminDomain | null {
  if (path.startsWith("/admin/hr")) return "hr"
  if (path.startsWith("/admin/finance") || path.startsWith("/admin/purchasing")) return "finance"
  if (path.startsWith("/admin/assets") || path.startsWith("/admin/inventory")) return "assets"
  if (path.startsWith("/admin/reports") || path.startsWith("/admin/audit-logs")) return "reports"
  if (path.startsWith("/admin/tasks")) return "tasks"
  if (
    path.startsWith("/admin/documentation") ||
    path.startsWith("/admin/feedback") ||
    path.startsWith("/admin/notifications") ||
    path.startsWith("/admin/communications") ||
    path.startsWith("/admin/correspondence") ||
    path.startsWith("/admin/tools") ||
    path.startsWith("/admin/help-desk")
  ) {
    return "communications"
  }
  return null
}

export function canAccessAdminPath(scope: AdminAccessScope, path: string): boolean {
  const context = buildAccessContextV2({
    role: scope.role || "",
    isDepartmentLead: scope.isDepartmentLead,
    isAdminLike: scope.isAdminLike,
    managedDepartments: [],
    adminDomains: scope.adminDomains,
    scopeMode: scope.scopeMode,
  })

  const route = resolveAdminRouteKeyV2(path)
  return canAccessRouteV2(context, route)
}

export { buildAccessContextV2, type AccessContextV2 }
