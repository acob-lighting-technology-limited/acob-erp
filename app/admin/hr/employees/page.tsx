import { redirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AdminEmployeeContent, type Employee, type UserProfile } from "./admin-employee-content"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"
import type { Database, UserRole } from "@/types/database"

const log = logger("admin-employees")

async function getAdminEmployeeData() {
  const supabase = await createClient()
  const typedSupabase = supabase as SupabaseClient<Database>
  const dataClient = getServiceRoleClientOrFallback(typedSupabase)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(typedSupabase, user.id)
  if (!scope) {
    return { redirect: "/profile" as const }
  }
  const userProfile: UserProfile = {
    role: scope.role as UserRole,
    managed_departments: scope.managedDepartments,
  }

  // Fetch employees - all leads can view users; mutation is restricted in the UI and backend.
  const query = dataClient.from("profiles").select("*").order("last_name", { ascending: true })

  const { data: employeeData, error: employeeError } = await query

  if (employeeError) {
    log.error({ err: employeeError }, "Error loading employees")
    return { employees: [], userProfile }
  }

  return {
    employees: (employeeData || []) as Employee[],
    userProfile,
  }
}

export default async function AdminEmployeePage() {
  const data = await getAdminEmployeeData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    employees: Employee[]
    userProfile: UserProfile
  }

  return <AdminEmployeeContent initialEmployees={pageData.employees} userProfile={pageData.userProfile} />
}
