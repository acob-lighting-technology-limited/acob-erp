import type { EmploymentStatus } from "@/types/database"

export interface AssignableProfileLite {
  id: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  department?: string | null
  employment_status?: EmploymentStatus | string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

export interface AssignablePolicyOptions {
  allowLegacyNullStatus?: boolean
  requiredDepartment?: string | null
}

export interface AssignableQueryOptions extends AssignablePolicyOptions {
  select?: string
  orderBy?: "first_name" | "last_name" | "full_name"
  departmentScope?: string[] | null
  leadOnly?: boolean
  excludeUserId?: string
}

const ASSIGNABLE_SELECT =
  "id, first_name, last_name, full_name, company_email, department, employment_status, is_department_lead, lead_departments"

export function isAssignableEmploymentStatus(
  status: EmploymentStatus | string | null | undefined,
  options: AssignablePolicyOptions = {}
): boolean {
  if (status === "active") return true
  if (options.allowLegacyNullStatus === false) return false
  return status == null
}

export function isAssignableProfile(
  profile: Pick<AssignableProfileLite, "employment_status" | "department">,
  options: AssignablePolicyOptions = {}
): boolean {
  if (!isAssignableEmploymentStatus(profile.employment_status, options)) return false
  if (options.requiredDepartment && profile.department !== options.requiredDepartment) return false
  return true
}

export function getUnassignableReason(
  profile: Pick<AssignableProfileLite, "employment_status" | "department">,
  options: AssignablePolicyOptions = {}
): string | null {
  if (!isAssignableEmploymentStatus(profile.employment_status, options)) {
    return "Selected assignee is not active"
  }
  if (options.requiredDepartment && profile.department !== options.requiredDepartment) {
    return "Selected assignee must belong to the service department"
  }
  return null
}

export function applyAssignableStatusFilter(query: any, options: AssignablePolicyOptions = {}) {
  if (options.allowLegacyNullStatus === false) {
    return query.eq("employment_status", "active")
  }
  return query.or("employment_status.eq.active,employment_status.is.null")
}

export function buildAssignableProfilesQuery(client: any, options: AssignableQueryOptions = {}) {
  let query = client
    .from("profiles")
    .select(options.select || ASSIGNABLE_SELECT)
    .order(options.orderBy || "last_name", { ascending: true })

  query = applyAssignableStatusFilter(query, options)

  if (options.departmentScope) {
    query =
      options.departmentScope.length > 0 ? query.in("department", options.departmentScope) : query.eq("id", "__none__")
  }

  if (options.requiredDepartment) {
    query = query.eq("department", options.requiredDepartment)
  }

  if (options.leadOnly) {
    query = query.eq("is_department_lead", true)
  }

  if (options.excludeUserId) {
    query = query.neq("id", options.excludeUserId)
  }

  return query
}

export async function listAssignableProfiles(client: any, options: AssignableQueryOptions = {}) {
  const { data, error } = await buildAssignableProfilesQuery(client, options)
  if (error) return { data: [] as AssignableProfileLite[], error }
  const rows = (data || []) as AssignableProfileLite[]
  return {
    data: rows.filter((profile) => isAssignableProfile(profile, options)),
    error: null,
  }
}
