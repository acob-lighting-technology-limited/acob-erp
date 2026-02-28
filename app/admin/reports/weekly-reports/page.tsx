import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WeeklyReportsContent } from "./weekly-reports-content"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

export default async function WeeklyReportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    redirect("/dashboard")
  }
  const departmentScope = getDepartmentScope(scope, "general")

  // Fetch departments for filtering
  let employeeQuery = supabase.from("profiles").select("department").not("department", "is", null)
  if (departmentScope) {
    employeeQuery =
      departmentScope.length > 0 ? employeeQuery.in("department", departmentScope) : employeeQuery.eq("id", "__none__")
  }
  const { data: employeeData } = await employeeQuery

  const departments = Array.from(new Set(employeeData?.map((s: any) => s.department).filter(Boolean))) as string[]
  departments.sort()

  return (
    <WeeklyReportsContent
      initialDepartments={departments}
      scopedDepartments={departmentScope ?? []}
      currentUser={{
        id: user.id,
        role: scope.role,
        department: scope.department,
      }}
    />
  )
}
