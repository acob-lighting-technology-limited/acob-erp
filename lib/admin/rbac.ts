import type { SupabaseClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type AdminRole = "super_admin" | "admin" | "lead" | "employee" | "visitor" | string
export type AdminSection =
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
  leadDepartments: string[]
  managedDepartments: string[]
  managedOffices: string[]
  isAdminLike: boolean
  isFinanceGlobalLead: boolean
  isHrGlobalLead: boolean
}

interface ProfileShape {
  role: AdminRole | null
  department: string | null
  office_location: string | null
  lead_departments: string[] | null
}

const FINANCE_DEPARTMENT_ALIASES = ["Accounts", "Finance"]

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
  return role === "admin" || role === "super_admin"
}

export function roleCanEnterAdmin(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "admin" || role === "lead"
}

export function canAccessAdminSection(scope: AdminScope, section: AdminSection): boolean {
  if (scope.isAdminLike) return true
  if (scope.role !== "lead") return false

  // Leads are permitted across admin sections by policy, but always scoped by managed departments/offices.
  switch (section) {
    case "admin":
    case "assets":
    case "audit-logs":
    case "documentation":
    case "employees":
    case "feedback":
    case "finance":
    case "hr":
    case "inventory":
    case "job-descriptions":
    case "notification":
    case "onedrive":
    case "payments":
    case "projects":
    case "purchasing":
    case "reports":
    case "settings":
    case "tasks":
      return true
    default:
      return false
  }
}

function scopeDepartments(profile: ProfileShape): string[] {
  const leadDepartments = normalizeDepartmentList(
    Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  )
  if (leadDepartments.length > 0) return leadDepartments
  if (profile.department) return normalizeDepartmentList([profile.department])
  return []
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
    .select("role, department, office_location, lead_departments")
    .eq("id", userId)
    .single<ProfileShape>()

  if (!profile?.role || !roleCanEnterAdmin(profile.role)) return null

  const isAdminLike = isAdminLikeRole(profile.role)
  const managedDepartments = isAdminLike ? [] : scopeDepartments(profile)
  const managedOffices = isAdminLike
    ? []
    : await resolveManagedOffices(supabase, managedDepartments, profile.office_location ?? null)

  const isFinanceGlobalLead =
    profile.role === "lead" && hasDepartmentAlias(managedDepartments, FINANCE_DEPARTMENT_ALIASES)
  const isHrGlobalLead = profile.role === "lead" && managedDepartments.includes("Admin & HR")

  return {
    userId,
    role: profile.role,
    department: profile.department ?? null,
    officeLocation: profile.office_location ?? null,
    leadDepartments: Array.isArray(profile.lead_departments) ? profile.lead_departments : [],
    managedDepartments,
    managedOffices,
    isAdminLike,
    isFinanceGlobalLead,
    isHrGlobalLead,
  }
}

export function getDepartmentScope(scope: AdminScope, domain: "finance" | "hr" | "general"): string[] | null {
  if (scope.isAdminLike) return null
  if (scope.role !== "lead") return []
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
