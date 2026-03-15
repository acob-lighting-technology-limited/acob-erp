import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { DEPT_EXECUTIVE_MANAGEMENT, DEPT_CORPORATE_SERVICES } from "@/config/constants"

export type AssetMailRoutingProfile = {
  id: string
  full_name: string | null
  first_name?: string | null
  last_name?: string | null
  company_email?: string | null
  department: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
  employment_status?: string | null
}

export type AssetMailRoutingRow = {
  employee_id: string
  employee_name: string
  department: string
  routing_class: "employee" | "department_lead" | "hcs" | "md"
  recipients: string[]
}

export function getProfileDisplayName(profile: AssetMailRoutingProfile): string {
  const fullName = profile.full_name?.trim()
  if (fullName) return fullName

  const joined = `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
  if (joined) return joined

  return profile.company_email || profile.id
}

export function profileLeadsDepartment(
  profile: AssetMailRoutingProfile,
  department: string | null | undefined
): boolean {
  if (!profile.is_department_lead || !department) return false

  if (profile.department === department) return true

  const managed = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  return managed.includes(department)
}

export function resolveAssetMailSpecialRecipients(profiles: AssetMailRoutingProfile[]) {
  const activeProfiles = profiles.filter((profile) =>
    isAssignableEmploymentStatus(profile.employment_status, { allowLegacyNullStatus: false })
  )

  const hcs = activeProfiles.find(
    (profile) => profileLeadsDepartment(profile, DEPT_CORPORATE_SERVICES) || profile.department === DEPT_CORPORATE_SERVICES
  )

  const md = activeProfiles.find(
    (profile) =>
      profileLeadsDepartment(profile, DEPT_EXECUTIVE_MANAGEMENT) || profile.department === DEPT_EXECUTIVE_MANAGEMENT
  )

  return { hcs, md }
}

export function resolveDepartmentLead(
  profiles: AssetMailRoutingProfile[],
  department: string | null | undefined
): AssetMailRoutingProfile | null {
  if (!department) return null
  return profiles.find((profile) => profileLeadsDepartment(profile, department)) || null
}

export function getAssetMailRoutingClass(
  profile: AssetMailRoutingProfile,
  specialRecipients: ReturnType<typeof resolveAssetMailSpecialRecipients>
): AssetMailRoutingRow["routing_class"] {
  if (specialRecipients.md && profile.id === specialRecipients.md.id) return "md"
  if (specialRecipients.hcs && profile.id === specialRecipients.hcs.id) return "hcs"
  if (profile.is_department_lead) return "department_lead"
  return "employee"
}

export function resolveAssetMailRecipients(
  profile: AssetMailRoutingProfile,
  profiles: AssetMailRoutingProfile[],
  specialRecipients: ReturnType<typeof resolveAssetMailSpecialRecipients>
): string[] {
  const selfName = getProfileDisplayName(profile)
  const routingClass = getAssetMailRoutingClass(profile, specialRecipients)

  if (routingClass === "md") return [selfName]

  if (routingClass === "hcs") {
    return [selfName, specialRecipients.md ? getProfileDisplayName(specialRecipients.md) : null].filter(
      Boolean
    ) as string[]
  }

  if (routingClass === "department_lead") {
    return [
      selfName,
      specialRecipients.hcs ? getProfileDisplayName(specialRecipients.hcs) : null,
      specialRecipients.md ? getProfileDisplayName(specialRecipients.md) : null,
    ].filter(Boolean) as string[]
  }

  const departmentLead = resolveDepartmentLead(profiles, profile.department)
  return [selfName, departmentLead ? getProfileDisplayName(departmentLead) : null].filter(Boolean) as string[]
}

export function buildAssetMailRoutingRows(profiles: AssetMailRoutingProfile[]): AssetMailRoutingRow[] {
  const activeProfiles = profiles.filter((profile) =>
    isAssignableEmploymentStatus(profile.employment_status, { allowLegacyNullStatus: false })
  )
  const specialRecipients = resolveAssetMailSpecialRecipients(activeProfiles)

  return activeProfiles.map((profile) => ({
    employee_id: profile.id,
    employee_name: getProfileDisplayName(profile),
    department: profile.department || "Unassigned",
    routing_class: getAssetMailRoutingClass(profile, specialRecipients),
    recipients: Array.from(new Set(resolveAssetMailRecipients(profile, activeProfiles, specialRecipients))),
  }))
}
