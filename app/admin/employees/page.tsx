import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminEmployeeContent, type Employee, type UserProfile } from "./admin-employee-content"
import { resolveAdminScope } from "@/lib/admin/rbac"

async function getAdminemployeeData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return { redirect: "/dashboard" as const }
  }
  const userProfile: UserProfile = {
    role: scope.role as any,
    managed_departments: scope.managedDepartments,
  }

  // Fetch employees - all leads can view users; mutation is restricted in the UI and backend.
  let query = supabase.from("profiles").select("*").order("last_name", { ascending: true })

  const { data: employeeData, error: employeeError } = await query

  if (employeeError) {
    console.error("Error loading employee:", employeeError)
    return { employee: [], userProfile }
  }

  return {
    employee: (employeeData || []) as Employee[],
    userProfile,
  }
}

export default async function AdminemployeePage() {
  const data = await getAdminemployeeData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    employee: Employee[]
    userProfile: UserProfile
  }

  return <AdminEmployeeContent initialEmployees={pageData.employee} userProfile={pageData.userProfile} />
}
