import type { SupabaseClient } from "@supabase/supabase-js"
import { isAdminLikeRole, resolveAdminScope } from "@/lib/admin/rbac"
import { DEPT_ACCOUNTS, DEPT_ADMIN_HR, DEPT_CORPORATE_SERVICES, normalizeDepartmentName } from "@/shared/departments"

const EXECUTIVE_DEPARTMENT = normalizeDepartmentName("Executive Management")

/**
 * Who may sign off an emergency requisition.
 *
 * The expedited route drops the review / authorization / verification tiers, so the
 * single remaining signature has to be a real one: an admin-like role, or the lead of
 * Executive Management. Without this gate any authenticated user could clear an
 * emergency requisition end to end.
 */
export async function canApproveEmergencyRequisition(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const scope = await resolveAdminScope(supabase, userId)
  if (!scope) return false

  if (isAdminLikeRole(scope.role)) return true

  if (!scope.isDepartmentLead) return false

  const managed = (scope.managedDepartments || []).map((dept) => normalizeDepartmentName(String(dept || "")))
  const primary = normalizeDepartmentName(String(scope.department || ""))
  return managed.includes(EXECUTIVE_DEPARTMENT) || primary === EXECUTIVE_DEPARTMENT
}

/** Department whose lead signs each normal-route stage (see REQUISITION_STAGES). */
const STAGE_DEPARTMENTS: Record<string, string> = {
  pending_reviewed_by: DEPT_ADMIN_HR,
  pending_authorized_by: DEPT_CORPORATE_SERVICES,
  pending_verified_by: DEPT_ACCOUNTS,
  pending_approved_by: EXECUTIVE_DEPARTMENT,
}

export interface RequisitionActor {
  userId: string
  isAdminLike: boolean
  /** Normalized departments this user leads. */
  ledDepartments: string[]
  department: string
}

export async function resolveRequisitionActor(
  supabase: SupabaseClient,
  userId: string
): Promise<RequisitionActor | null> {
  const scope = await resolveAdminScope(supabase, userId)
  if (!scope) return null
  const led = scope.isDepartmentLead
    ? [...(scope.managedDepartments || []), scope.department]
        .map((dept) => normalizeDepartmentName(String(dept || "")))
        .filter(Boolean)
    : []
  return {
    userId,
    isAdminLike: isAdminLikeRole(scope.role),
    ledDepartments: Array.from(new Set(led)),
    department: normalizeDepartmentName(String(scope.department || "")),
  }
}

/** Departments whose lead signs at least one stage — they see the approvals queue. */
export function isRequisitionApprover(actor: RequisitionActor): boolean {
  if (actor.isAdminLike) return true
  const stageDepts = new Set(Object.values(STAGE_DEPARTMENTS))
  return actor.ledDepartments.some((dept) => stageDepts.has(dept))
}

/**
 * Who may approve or reject a requisition sitting at `stageCode`.
 *
 * Each stage belongs to one department's lead; admin-like roles may act on any
 * stage. Nobody signs off their own requisition unless they hold an admin-like
 * role (segregation of duties — the requester cannot be their own reviewer).
 */
export function canActOnRequisitionStage(
  actor: RequisitionActor,
  stageCode: string,
  requesterId: string | null
): boolean {
  if (actor.isAdminLike) return true
  if (requesterId && requesterId === actor.userId) return false
  const stageDept = STAGE_DEPARTMENTS[stageCode]
  return Boolean(stageDept) && actor.ledDepartments.includes(stageDept)
}
