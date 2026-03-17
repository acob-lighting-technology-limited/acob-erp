import { getAssignableRolesForActor } from "@/lib/role-management"

const ALLOWED_ROLES = ["developer", "super_admin", "admin", "employee", "visitor"] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

export function isValidRole(role: string): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole)
}

export function getRoleOptions(currentUserRole: string): AllowedRole[] {
  return getAssignableRolesForActor(currentUserRole).filter((role): role is AllowedRole => isValidRole(role))
}
