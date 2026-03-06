import type { SupabaseClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type AdminRole = "developer" | "super_admin" | "admin" | "employee" | "visitor" | string
export type AdminDomain =
  | "hr"
  | "finance"
  | "assets"
  | "reports"
  | "tasks"
  | "projects"
  | "employees"
  | "communications"
export type AdminSection =
  | "dev"
  | "assets"
  | "audit-logs"
  | "documentation"
  | "employees"
  | "feedback"
  | "finance"
  | "hr"
  | "inventory"
  | "job-descriptions"
  | "notification"
  | "onedrive"
  | "payments"
  | "projects"
  | "purchasing"
  | "reports"
  | "settings"
  | "tasks"
  | "admin"

export interface AdminScope {
  userId: string
  role: AdminRole
  department: string | null
  officeLocation: string | null
  isDepartmentLead: boolean
  leadDepartments: string[]
  managedDepartments: string[]
  managedOffices: string[]
  isAdminLike: boolean
  isFinanceGlobalLead: boolean
  isHrGlobalLead: boolean
  adminDomains: AdminDomain[] | null
}

interface ProfileShape {
  role: AdminRole | null
  department: string | null
  office_location: string | null
  admin_domains: string[] | null
  is_department_lead: boolean
  lead_departments: string[] | null
}

const FINANCE_DEPARTMENT_ALIASES = ["Accounts", "Finance"]
const ADMIN_DOMAINS: AdminDomain[] = [
  "hr",
  "finance",
  "assets",
  "reports",
  "tasks",
  "projects",
  "employees",
  "communications",
]
const SECTION_TO_DOMAIN: Partial<Record<AdminSection, AdminDomain>> = {
  hr: "hr",
  "job-descriptions": "hr",
  finance: "finance",
  payments: "finance",
  purchasing: "finance",
  assets: "assets",
  inventory: "assets",
  reports: "reports",
  "audit-logs": "reports",
  tasks: "tasks",
  projects: "projects",
  employees: "employees",
  documentation: "communications",
  feedback: "communications",
  notification: "communications",
  onedrive: "communications",
}

function unique(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((v) => v.trim())
        .filter(Boolean)
    )
  )
}

function normalizeDepartmentName(value: string): string {
  if (value.toLowerCase() === "finance") return "Accounts"
  return value
}

function normalizeDepartmentList(values: string[]): string[] {
  return unique(values.map(normalizeDepartmentName))
}

function hasDepartmentAlias(departments: string[], aliases: string[]): boolean {
  const normalized = new Set(normalizeDepartmentList(departments).map((v) => v.toLowerCase()))
  return aliases.some((alias) => normalized.has(normalizeDepartmentName(alias).toLowerCase()))
}

export function isAdminLikeRole(role: string | null | undefined): boolean {
  return role === "developer" || role === "admin" || role === "super_admin"
}

export function roleCanEnterAdmin(role: string | null | undefined, isDepartmentLead = false): boolean {
  return role === "developer" || role === "super_admin" || role === "admin" || isDepartmentLead
}

export function canAccessAdminSection(scope: AdminScope, section: AdminSection): boolean {
  if (section === "dev") return scope.role === "developer"
  if (scope.role === "developer" || scope.role === "super_admin") return true
  if (scope.role === "admin") {
    if (!scope.adminDomains || scope.adminDomains.length === 0) return true
    if (section === "admin") return true
    const mapped = SECTION_TO_DOMAIN[section]
    return mapped ? scope.adminDomains.includes(mapped) : false
  }
  if (!scope.isDepartmentLead) return false

  // Department leads are permitted across admin sections by policy, scoped by managed departments/offices.
  return true
}

function scopeDepartments(profile: ProfileShape): string[] {
  const leadDepartments = normalizeDepartmentList(
    Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  )
  if (leadDepartments.length > 0) return leadDepartments
  if (profile.department) return normalizeDepartmentList([profile.department])
  return []
}

function normalizeAdminDomains(domains: string[] | null | undefined): AdminDomain[] | null {
  if (!Array.isArray(domains)) return null
  const normalized = Array.from(
    new Set(
      domains
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
  ).filter((value): value is AdminDomain => ADMIN_DOMAINS.includes(value as AdminDomain))
  return normalized.length > 0 ? normalized : []
}

async function resolveManagedOffices(
  supabase: SupabaseClient,
  managedDepartments: string[],
  ownOffice: string | null
): Promise<string[]> {
  const offices = new Set<string>()
  if (ownOffice) offices.add(ownOffice)

  if (managedDepartments.length > 0) {
    const { data } = await supabase.from("office_locations").select("name").in("department", managedDepartments)

    for (const row of data || []) {
      if (row?.name) offices.add(row.name)
    }
  }

  return Array.from(offices)
}

export async function resolveAdminScope(supabase: SupabaseClient, userId: string): Promise<AdminScope | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department, office_location, admin_domains, is_department_lead, lead_departments")
    .eq("id", userId)
    .single<ProfileShape>()

  if (!profile?.role || !roleCanEnterAdmin(profile.role, profile.is_department_lead)) return null

  const isAdminLike = isAdminLikeRole(profile.role)
  const managedDepartments = isAdminLike ? [] : scopeDepartments(profile)
  const managedOffices = isAdminLike
    ? []
    : await resolveManagedOffices(supabase, managedDepartments, profile.office_location ?? null)

  const isDepartmentLead = Boolean(profile.is_department_lead)
  const adminDomains = normalizeAdminDomains(profile.admin_domains)
  const isFinanceGlobalLead = isDepartmentLead && hasDepartmentAlias(managedDepartments, FINANCE_DEPARTMENT_ALIASES)
  const isHrGlobalLead = isDepartmentLead && managedDepartments.includes("Admin & HR")

  return {
    userId,
    role: profile.role,
    department: profile.department ?? null,
    officeLocation: profile.office_location ?? null,
    isDepartmentLead,
    leadDepartments: Array.isArray(profile.lead_departments) ? profile.lead_departments : [],
    managedDepartments,
    managedOffices,
    isAdminLike,
    isFinanceGlobalLead,
    isHrGlobalLead,
    adminDomains,
  }
}

export function getDepartmentScope(scope: AdminScope, domain: "finance" | "hr" | "general"): string[] | null {
  if (scope.isAdminLike) return null
  if (!scope.isDepartmentLead) return []
  if (domain === "finance" && scope.isFinanceGlobalLead) return null
  if (domain === "hr" && scope.isHrGlobalLead) return null
  return scope.managedDepartments
}

export async function requireAdminSectionAccess(section: AdminSection): Promise<AdminScope> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) redirect("/dashboard")
  if (!canAccessAdminSection(scope, section)) redirect("/admin")

  return scope
}
