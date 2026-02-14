import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminEmployeeContent, type Employee, type UserProfile } from "./admin-employee-content"

async function getAdminEmployeeData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("role, lead_departments").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    return { redirect: "/dashboard" as const }
  }

  const userProfile: UserProfile = {
    role: profile.role,
  }

  // Fetch employees - leads can only see employees in their departments
  let query = supabase.from("profiles").select("*").order("last_name", { ascending: true })

  if (profile.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
    query = query.in("department", profile.lead_departments)
  }

  const { data: employeeData, error: employeeError } = await query

  if (employeeError) {
    console.error("Error loading employees:", employeeError)
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
