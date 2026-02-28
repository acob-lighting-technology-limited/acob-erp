import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ActionTrackerContent } from "./action-tracker-content"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

export default async function ActionTrackerPage() {
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
    <Suspense fallback={<div className="flex justify-center py-20">Loading Tracker...</div>}>
      <ActionTrackerContent initialDepartments={departments} scopedDepartments={departmentScope ?? []} />
    </Suspense>
  )
}
