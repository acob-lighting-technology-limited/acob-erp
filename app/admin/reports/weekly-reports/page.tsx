import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { WeeklyReportsContent } from "./weekly-reports-content"
import { resolveAdminScope } from "@/lib/admin/rbac"

type EmployeeRow = {
  id: string
  full_name: string | null
  department: string | null
}

export default async function WeeklyReportsPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) {
    redirect("/profile")
  }

  // Fetch departments for filtering and presenter options for week setup.
  const { data: employeeData } = await dataClient
    .from("profiles")
    .select("id, full_name, department")
    .not("department", "is", null)
    .returns<EmployeeRow[]>()

  const departments = Array.from(new Set((employeeData || []).map((row) => row.department).filter(Boolean))) as string[]
  departments.sort()

  const employees = (employeeData || [])
    .filter((row) => row?.id && row?.full_name && row?.department)
    .map((row) => ({
      id: String(row.id),
      full_name: String(row.full_name),
      department: String(row.department),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <WeeklyReportsContent
      initialDepartments={departments}
      employees={employees}
      scopedDepartments={[]}
      editableDepartments={scope.isAdminLike ? [] : scope.managedDepartments || []}
      currentUser={{
        id: user.id,
        role: scope.role,
        department: scope.department,
        is_department_lead: scope.isDepartmentLead,
        lead_departments: scope.leadDepartments,
        admin_domains: scope.adminDomains,
      }}
    />
  )
}
