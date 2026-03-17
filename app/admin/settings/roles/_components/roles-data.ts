import { createClient } from "@/lib/supabase/client"
import type { Role } from "./role-form-dialog"

export const DEFAULT_ROLES: Role[] = [
  {
    id: "1",
    name: "super_admin",
    description: "Full system access",
    permissions: [
      "users.view",
      "users.manage",
      "roles.manage",
      "hr.view",
      "hr.manage",
      "finance.view",
      "finance.manage",
      "inventory.view",
      "inventory.manage",
      "purchasing.view",
      "purchasing.manage",
      "settings.manage",
      "reports.view",
    ],
    is_system: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    name: "developer",
    description: "Developer-level access (matches Super Admin)",
    permissions: [
      "users.view",
      "users.manage",
      "roles.manage",
      "hr.view",
      "hr.manage",
      "finance.view",
      "finance.manage",
      "inventory.view",
      "inventory.manage",
      "purchasing.view",
      "purchasing.manage",
      "settings.manage",
      "reports.view",
    ],
    is_system: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    name: "admin",
    description: "Administrative access",
    permissions: ["users.view", "users.manage", "hr.view", "hr.manage", "finance.view", "reports.view"],
    is_system: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "4",
    name: "employee",
    description: "Standard employee access",
    permissions: ["hr.view"],
    is_system: true,
    created_at: new Date().toISOString(),
  },
]

export async function fetchRolesData(): Promise<Role[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("roles").select("*").order("name")

  if (error) {
    if (error.code === "42P01" || error.message?.includes("relation")) {
      return DEFAULT_ROLES
    }
    throw new Error(error.message)
  }

  const { data: profiles } = await supabase.from("profiles").select("role")
  const roleCounts = new Map<string, number>()
  profiles?.forEach((p) => {
    roleCounts.set(p.role, (roleCounts.get(p.role) || 0) + 1)
  })

  return (data || []).map((r) => ({
    ...r,
    user_count: roleCounts.get(r.name) || 0,
  }))
}
