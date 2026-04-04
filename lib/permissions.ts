import type { UserRole } from "@/types/database"
import { canAssignRole as canAssignManagedRole } from "@/lib/role-management"

/**
 * Role Hierarchy (from highest to lowest):
 * 1. developer - Full system access including dev tools
 * 2. super_admin - Full system access, can assign all roles
 * 3. admin - HR/Finance functions, global admin access
 * 4. employee - Regular employees
 * 5. visitor - Read-only guest access
 *
 * Department leadership is a SEPARATE concern — see is_department_lead + lead_departments.
 * A user of ANY role can be a department lead.
 */

// Helper to check role hierarchy
export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  const hierarchy: UserRole[] = ["visitor", "employee", "admin", "super_admin", "developer"]
  const userLevel = hierarchy.indexOf(userRole)
  const requiredLevel = hierarchy.indexOf(requiredRole)
  return userLevel >= requiredLevel
}

/** Check if profile has department lead identity (org position, NOT a role) */
export function isDepartmentLead(profile: { is_department_lead?: boolean } | null | undefined): boolean {
  return Boolean(profile?.is_department_lead)
}

/** Check if a department lead manages a specific department */
export function isLeadOfDepartment(
  profile: { is_department_lead?: boolean; lead_departments?: string[] } | null | undefined,
  department: string
): boolean {
  if (!isDepartmentLead(profile)) return false
  return Array.isArray(profile?.lead_departments) && profile.lead_departments.includes(department)
}

export function canViewAllemployee(role: UserRole): boolean {
  return hasRoleOrHigher(role, "admin") // admin and super_admin
}

export function canViewDepartmentemployee(
  role: UserRole,
  leadDepartments: string[],
  employeeDepartment: string,
  isDeptLead = false
): boolean {
  if (canViewAllemployee(role)) return true
  return isDeptLead && leadDepartments.includes(employeeDepartment)
}

export function canDeleteEmployee(role: UserRole): boolean {
  return hasRoleOrHigher(role, "admin") // Only admin and super_admin can delete employees
}

export function canManageDevices(role: UserRole): boolean {
  return hasRoleOrHigher(role, "admin") // admin and super_admin
}

export function canCreateTasks(role: UserRole, isDeptLead = false): boolean {
  return hasRoleOrHigher(role, "admin") || isDeptLead
}

export function canViewTask(
  role: UserRole,
  leadDepartments: string[],
  task: { assigned_to: string; assigned_by: string; department?: string },
  userId: string,
  isDeptLead = false
): boolean {
  if (hasRoleOrHigher(role, "admin")) return true // admin and super_admin see all
  if (task.assigned_to === userId || task.assigned_by === userId) return true
  if (isDeptLead && task.department && leadDepartments.includes(task.department)) return true
  return false
}

export function canViewUserDocumentation(
  viewerRole: UserRole,
  viewerLeadDepartments: string[],
  documentOwnerDepartment: string,
  documentOwnerId: string,
  viewerId: string,
  viewerIsDeptLead = false
): boolean {
  if (documentOwnerId === viewerId) return true
  if (hasRoleOrHigher(viewerRole, "admin")) return true // admin and super_admin see all
  if (viewerIsDeptLead && viewerLeadDepartments.includes(documentOwnerDepartment)) return true
  return false
}

export function canViewAuditLogs(role: UserRole, isDeptLead = false): boolean {
  return hasRoleOrHigher(role, "admin") || isDeptLead
}

export function canCreateProjects(role: UserRole, isDeptLead = false): boolean {
  return hasRoleOrHigher(role, "admin") || isDeptLead
}

export function canViewProject(
  role: UserRole,
  leadDepartments: string[],
  project: { created_by: string; project_manager_id?: string },
  userId: string,
  isProjectMember: boolean,
  isDeptLead = false
): boolean {
  if (hasRoleOrHigher(role, "admin")) return true // admin and super_admin see all
  if (project.created_by === userId || project.project_manager_id === userId) return true
  if (isProjectMember) return true
  if (isDeptLead) return true // department leads can see all projects
  return false
}

export function canEditProject(
  role: UserRole,
  project: { created_by: string; project_manager_id?: string },
  userId: string
): boolean {
  if (hasRoleOrHigher(role, "admin")) return true // admin and super_admin can edit all
  if (project.created_by === userId || project.project_manager_id === userId) return true
  return false
}

export function canDeleteProject(role: UserRole): boolean {
  return hasRoleOrHigher(role, "admin") // only admin and super_admin
}

export function canManageProjectMembers(
  role: UserRole,
  project: { created_by: string; project_manager_id?: string },
  userId: string
): boolean {
  if (hasRoleOrHigher(role, "admin")) return true // admin and super_admin can manage all
  if (project.created_by === userId || project.project_manager_id === userId) return true
  return false
}

export function canAssignRoles(assignerRole: UserRole, targetRole: UserRole): boolean {
  return canAssignManagedRole(assignerRole, targetRole)
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    visitor: "Visitor",
    employee: "Employee",
    admin: "Admin",
    super_admin: "Super Admin",
    developer: "Developer",
  }
  return roleNames[role] || role
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    visitor: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
    employee: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    developer: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  }
  return colors[role] || "bg-gray-100 text-gray-800"
}
