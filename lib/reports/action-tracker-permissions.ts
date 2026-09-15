/**
 * Who may do what to an action item.
 *
 * Two different rules, deliberately:
 *
 *  * Content — the directive text, its department, week, timeline and the list of
 *    responsible staff — stays with admins and the lead of the owning department.
 *    That is the same rule the tracker has always used.
 *
 *  * Progress — status and the hindrance note/evidence — follows accountability.
 *    A management directive names the staff held responsible, routinely across
 *    departments, so when names are on it only those people (and admins) may move
 *    it. `department` alone was letting anyone in the stamped department drive a
 *    directive they were never tagged on, while the tagged staff sitting in other
 *    departments could not touch their own.
 *
 * Directives with no names attached fall back to the department rule — that is
 * what "leave empty when the whole department is responsible" means in the form.
 */

import { isSameDepartment } from "@/shared/departments"

const ADMIN_ROLES = ["developer", "super_admin", "admin"]

export type ActionTrackerScopeProfile = {
  id?: string | null
  role?: string | null
  department?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

export type ActionTrackerPermissionItem = {
  department?: string | null
  origin?: string | null
  /** Named responsible staff. Empty/omitted for weekly report action points. */
  assigneeIds?: string[] | null
}

export function isActionTrackerAdmin(profile: ActionTrackerScopeProfile | null | undefined): boolean {
  return ADMIN_ROLES.includes(String(profile?.role || "").toLowerCase())
}

export type ActionTrackerPermissionOptions = {
  /** When true, global admin powers are honored. When false or omitted (e.g. portal routes), departmental boundaries apply even to admins. */
  isAdminContext?: boolean
}

/**
 * Check if the user belongs to the department, or is a department lead over it.
 */
export function isUserInActionDepartment(
  profile: ActionTrackerScopeProfile | null | undefined,
  department: string | null | undefined
): boolean {
  if (!profile || !department) return false
  if (isSameDepartment(profile.department, department)) return true
  if (profile.is_department_lead && Array.isArray(profile.lead_departments)) {
    return profile.lead_departments.some((leadDept) => isSameDepartment(leadDept, department))
  }
  return false
}

/** Admin (in admin context), or a lead over the department the item is stamped with. */
export function canManageActionDepartment(
  profile: ActionTrackerScopeProfile | null | undefined,
  department: string | null | undefined,
  options?: ActionTrackerPermissionOptions
): boolean {
  if (options?.isAdminContext && isActionTrackerAdmin(profile)) return true
  if (!department) return false
  if (!profile?.is_department_lead) return false
  if (isSameDepartment(profile.department, department)) return true
  const leadDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return leadDepartments.some((leadDept) => isSameDepartment(leadDept, department))
}

/** Editing the item itself: title, department, week/year, timeline, responsible staff, deletion. */
export function canEditActionContent(
  profile: ActionTrackerScopeProfile | null | undefined,
  item: ActionTrackerPermissionItem,
  options?: ActionTrackerPermissionOptions
): boolean {
  return canManageActionDepartment(profile, item.department, options)
}

/**
 * Moving the status or reporting a hindrance. Named responsible staff own their
 * directive regardless of which department it is filed under; for department-wide
 * directives or weekly report action points, staff belonging to that department
 * (or leading that department) may move it.
 *
 * In portal context (isAdminContext !== true), admin powers do not override department
 * boundaries: only the named assignees, department members, or department leads may update progress.
 */
export function canUpdateActionProgress(
  profile: ActionTrackerScopeProfile | null | undefined,
  item: ActionTrackerPermissionItem,
  options?: ActionTrackerPermissionOptions
): boolean {
  if (options?.isAdminContext && isActionTrackerAdmin(profile)) return true

  const assigneeIds = item.origin === "management_directive" ? (item.assigneeIds || []).filter(Boolean).map(String) : []

  if (assigneeIds.length > 0) {
    return Boolean(profile?.id && assigneeIds.includes(String(profile.id)))
  }

  return isUserInActionDepartment(profile, item.department)
}
