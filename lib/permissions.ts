import type { UserRole, Profile } from "@/types/database"

/**
 * Role Hierarchy (from highest to lowest):
 * 1. super_admin - Full system access, can assign all roles
 * 2. admin - HR functions, cannot assign roles to leads or themselves
 * 3. lead - Department leads with limited management access
 * 4. employee - Regular employees
 * 5. visitor - Read-only guest access
 */

// Helper to check role hierarchy
export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  const hierarchy: UserRole[] = ["visitor", "employee", "lead", "admin", "super_admin"]
  const userLevel = hierarchy.indexOf(userRole)
  const requiredLevel = hierarchy.indexOf(requiredRole)
  return userLevel >= requiredLevel
}

export function canViewAllemployee(role: UserRole): boolean {
  return hasRoleOrHigher(role, "admin") // admin and super_admin
}

export function canViewDepartmentemployee(
  role: UserRole,
  leadDepartments: string[],
  employeeDepartment: string
): boolean {
  if (canViewAllemployee(role)) return true
  return role === "lead" && leadDepartments.includes(employeeDepartment)
}

export function canDeleteEmployee(role: UserRole): boolean {
  return hasRoleOrHigher(role, "admin") // Only admin and super_admin can delete employees
}

export function canManageDevices(role: UserRole): boolean {
  return hasRoleOrHigher(role, "admin") // admin and super_admin
}

export function canCreateTasks(role: UserRole): boolean {
  return hasRoleOrHigher(role, "lead") // lead, admin, and super_admin
}

export function canViewTask(
  role: UserRole,
  leadDepartments: string[],
  task: { assigned_to: string; assigned_by: string; department?: string },
  userId: string
): boolean {
  if (hasRoleOrHigher(role, "admin")) return true // admin and super_admin see all
  if (task.assigned_to === userId || task.assigned_by === userId) return true
  if (role === "lead" && task.department && leadDepartments.includes(task.department)) return true
  return false
}

export function canViewUserDocumentation(
  viewerRole: UserRole,
  viewerLeadDepartments: string[],
  documentOwnerDepartment: string,
  documentOwnerId: string,
  viewerId: string
): boolean {
  if (documentOwnerId === viewerId) return true
  if (hasRoleOrHigher(viewerRole, "admin")) return true // admin and super_admin see all
  if (viewerRole === "lead" && viewerLeadDepartments.includes(documentOwnerDepartment)) return true
  return false
}

export function canViewAuditLogs(role: UserRole): boolean {
  return hasRoleOrHigher(role, "lead") // lead, admin, and super_admin
}

export function canCreateProjects(role: UserRole): boolean {
  return hasRoleOrHigher(role, "lead") // lead, admin, and super_admin
}

export function canViewProject(
  role: UserRole,
  leadDepartments: string[],
  project: { created_by: string; project_manager_id?: string },
  userId: string,
  isProjectMember: boolean
): boolean {
  if (hasRoleOrHigher(role, "admin")) return true // admin and super_admin see all
  if (project.created_by === userId || project.project_manager_id === userId) return true
  if (isProjectMember) return true
  if (role === "lead") return true // leads can see all projects
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
  // super_admin can assign any role
  if (assignerRole === "super_admin") return true

  // admin can assign visitor, employee, and lead (but not admin or super_admin)
  if (assignerRole === "admin") {
    return ["visitor", "employee"].includes(targetRole)
  }

  // Others cannot assign roles
  return false
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    visitor: "Visitor",
    employee: "Employee",
    lead: "Lead",
    admin: "Admin",
    super_admin: "Super Admin",
  }
  return roleNames[role]
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    visitor: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
    employee: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    lead: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }
  return colors[role]
}

export const DEPARTMENTS = [
  "Accounts",
  "Admin & HR",
  "Business, Growth and Innovation",
  "IT and Communications",
  "Legal, Regulatory and Compliance",
  "Logistics",
  "Operations",
  "Technical",
] as const

export const OFFICE_LOCATIONS = [
  "Accounts",
  "Admin & HR",
  "Assistant Executive Director",
  "Business, Growth and Innovation",
  "General Conference Room",
  "IT and Communications",
  "Kitchen",
  "Legal, Regulatory and Compliance",
  "MD Conference Room",
  "MD Office",
  "Operations",
  "Reception",
  "Site",
  "Technical",
  "Technical Extension",
] as const

export type Department = (typeof DEPARTMENTS)[number]
export type OfficeLocation = (typeof OFFICE_LOCATIONS)[number]
