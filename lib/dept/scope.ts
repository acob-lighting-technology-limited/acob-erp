import type { SupabaseClient } from "@supabase/supabase-js"
import { consolePageKeys } from "@/lib/dept/delegated-pages"
import { normalizeDepartmentName, normalizeDepartmentList, isSameDepartment } from "@/shared/departments"

/** Set when the person is not the lead but holds a department delegation from the lead. */
export interface DeptDelegation {
  fromUserId: string
  /** Page keys from lib/dept/delegated-pages.ts. */
  pages: string[]
  validUntil: string
}

export interface DeptScope {
  userId: string
  role: string
  deptId: string
  deptName: string
  isAdminLike: boolean
  /** Present for a delegate: they act inside this department, limited to these pages. */
  delegation?: DeptDelegation
}

interface ProfileShape {
  role: string | null
  is_department_lead: boolean
  lead_departments: string[] | null
  department: string | null
  department_id: string | null
}

interface DepartmentRow {
  id: string
  name: string
}

function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null
  const n = role.trim().toLowerCase()
  return n.length > 0 ? n : null
}

/**
 * Resolves a DeptScope for the given user + department.
 *
 * Returns null when:
 *  - the user profile cannot be found
 *  - the department row does not exist
 *  - the user neither leads the requested department nor holds a live delegation for it
 *
 * A delegate gets a scope with `delegation` set. They never inherit the delegator's admin
 * role: isAdminLike is false and the role is their own.
 */
export async function resolveDeptScope(
  supabase: SupabaseClient,
  userId: string,
  deptId: string
): Promise<DeptScope | null> {
  if (!deptId) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_department_lead, lead_departments, department, department_id")
    .eq("id", userId)
    .single<ProfileShape>()

  if (!profile) return null

  // Fetch the target department
  const { data: dept } = await supabase.from("departments").select("id, name").eq("id", deptId).single<DepartmentRow>()

  if (!dept) return null

  const normalizedDeptName = normalizeDepartmentName(dept.name)

  // Verify ownership — via lead_departments / primary department or department_id match
  const leadDepts: string[] = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  const normalizedLeadDepts = normalizeDepartmentList([profile.department, ...leadDepts])

  const leadsByName = normalizedLeadDepts.some((d) => isSameDepartment(d, normalizedDeptName))
  const leadsByDeptId = profile.department_id === deptId
  const isLead = Boolean(profile.is_department_lead) && (leadsByName || leadsByDeptId)

  if (!isLead) {
    const delegation = await loadDelegation(supabase, userId, dept.id)
    if (!delegation) return null
    return {
      userId,
      role: normalizeRole(profile.role) ?? "employee",
      deptId: dept.id,
      deptName: dept.name,
      isAdminLike: false,
      delegation,
    }
  }

  const normalizedRole = normalizeRole(profile.role) ?? "employee"
  const isAdminLike = normalizedRole === "developer" || normalizedRole === "admin" || normalizedRole === "super_admin"

  return {
    userId,
    role: normalizedRole,
    deptId: dept.id,
    deptName: dept.name,
    isAdminLike,
  }
}

/**
 * The live delegation `userId` holds for a department: not withdrawn and not past its end date.
 * If more than one is live the pages are combined and the latest end date applies.
 */
async function loadDelegation(
  supabase: SupabaseClient,
  userId: string,
  deptId: string
): Promise<DeptDelegation | null> {
  const { data } = await supabase
    .from("dept_delegations")
    .select("delegator_id, pages, valid_until")
    .eq("delegate_id", userId)
    .eq("department_id", deptId)
    .is("revoked_at", null)
    .gt("valid_until", new Date().toISOString())
    .returns<Array<{ delegator_id: string; pages: string[] | null; valid_until: string }>>()

  const rows = data ?? []
  if (rows.length === 0) return null
  // Admin-side page keys ride along in the same row; only console pages open the console.
  const pages = consolePageKeys(Array.from(new Set(rows.flatMap((row) => row.pages ?? []))))
  if (pages.length === 0) return null
  const latest = rows.reduce((a, b) => (new Date(a.valid_until) > new Date(b.valid_until) ? a : b))
  return { fromUserId: latest.delegator_id, pages, validUntil: latest.valid_until }
}
