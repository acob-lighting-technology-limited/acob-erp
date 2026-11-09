import { getRoleDisplayName } from "@/lib/permissions"
import { normalizeDepartmentName } from "@/shared/departments"
import type { UserRole } from "@/types/database"
import type { EmployeeGender } from "./employee-types"

export function deriveLeadDepartments(
  department: string,
  isDepartmentLead: boolean,
  selected?: string[] | null
): string[] {
  if (!isDepartmentLead) return []
  const source = selected?.length ? selected : [department]
  return Array.from(new Set(source.map((name) => normalizeDepartmentName(name)).filter(Boolean)))
}

export const roleList: UserRole[] = ["visitor", "employee", "admin", "super_admin", "developer"]
export const ELEVATED_ROLES: UserRole[] = ["super_admin", "admin", "developer"]

export function getRoleBadgeLabel(role: UserRole): string {
  if (role === "super_admin") return "S. Admin"
  return getRoleDisplayName(role)
}

/**
 * Field contractors on payroll (CTR group without company email). Contract personnel
 * with company email addresses are active platform employees and appear under Employees.
 */
export function isContractStaff(employee: {
  employment_status?: string | null
  employment_type?: string | null
  company_email?: string | null
}): boolean {
  return (
    ((employee.employment_status || "").toLowerCase() === "contract" || employee.employment_type === "contract") &&
    !employee.company_email
  )
}

export const genderFilterOptions: { value: EmployeeGender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "unspecified", label: "Unspecified" },
]
