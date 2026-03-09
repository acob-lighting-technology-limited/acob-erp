import type { SupabaseClient } from "@supabase/supabase-js"
import { isAdminLikeRole } from "@/lib/admin/rbac"

interface OneDriveProfile {
  role: string | null
  department: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
}

export interface OneDriveAccessScope {
  isAdminLike: boolean
  managedDepartments: string[]
  allowedPrefixes: string[]
  defaultPath: string
  rootLabel: string
}

function normalizePath(path: string): string {
  const normalized = `/${path || ""}`.replace(/\/+/g, "/")
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

function uniqueDepartments(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean)))
}

export async function resolveOneDriveAccessScope(
  supabase: SupabaseClient,
  userId: string
): Promise<OneDriveAccessScope | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department, is_department_lead, lead_departments")
    .eq("id", userId)
    .single<OneDriveProfile>()

  if (!profile) return null

  if (isAdminLikeRole(profile.role)) {
    return {
      isAdminLike: true,
      managedDepartments: [],
      allowedPrefixes: ["/Projects"],
      defaultPath: "/Projects",
      rootLabel: "Projects",
    }
  }

  const leadDepartments = Array.isArray(profile.lead_departments) ? profile.lead_departments : []
  const managedDepartments = profile.is_department_lead
    ? uniqueDepartments([...leadDepartments, profile.department])
    : uniqueDepartments([profile.department])

  if (managedDepartments.length === 0) return null

  const allowedPrefixes = managedDepartments.map((dept) => normalizePath(`/Projects/${dept}`))
  const defaultDepartment = managedDepartments[0]

  return {
    isAdminLike: false,
    managedDepartments,
    allowedPrefixes,
    defaultPath: normalizePath(`/Projects/${defaultDepartment}`),
    rootLabel: managedDepartments.length === 1 ? defaultDepartment : "Projects",
  }
}

export function isPathAllowed(path: string, scope: OneDriveAccessScope): boolean {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath.startsWith("/Projects")) return false
  if (scope.isAdminLike) return true
  if (normalizedPath === "/Projects") return true
  return scope.allowedPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
}
