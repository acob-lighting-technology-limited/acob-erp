import type { AdminDomain, AdminScopeMode } from "@/lib/admin/rbac"

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
  const role = String(scope.role || "")
    .trim()
    .toLowerCase()
  const isDevRoute = path.startsWith("/admin/dev")

  if (isDevRoute) return role === "developer"
  if (path === "/admin") return scope.isAdminLike || scope.isDepartmentLead

  if (!scope.isAdminLike && !scope.isDepartmentLead) return false

  // Explicit lead context (or pure lead identity) behaves as lead-scoped view:
  // broad section access, no dev routes.
  if (scope.scopeMode === "lead" || (!scope.isAdminLike && scope.isDepartmentLead)) {
    return true
  }

  if (role === "developer" || role === "super_admin") return true

  if (role === "admin") {
    const mappedDomain = getDomainForAdminPath(path)
    const domains = Array.isArray(scope.adminDomains) ? scope.adminDomains : []
    return Boolean(mappedDomain && domains.includes(mappedDomain))
  }

  return false
}
