import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { ActionTrackerContent } from "./action-tracker-content"
import { resolveAdminScope } from "@/lib/admin/rbac"

type DepartmentRow = {
  department: string | null
}

export default async function ActionTrackerPage() {
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

  // Fetch departments for filtering
  const { data: employeeData } = await dataClient
    .from("profiles")
    .select("department")
    .not("department", "is", null)
    .returns<DepartmentRow[]>()

  const departments = Array.from(new Set((employeeData || []).map((row) => row.department).filter(Boolean))) as string[]
  departments.sort()

  return (
    <Suspense fallback={<div className="flex justify-center py-20">Loading Tracker...</div>}>
      <ActionTrackerContent
        initialDepartments={departments}
        scopedDepartments={[]}
        editableDepartments={scope.isAdminLike ? [] : scope.managedDepartments || []}
        canGlobalEdit={scope.isAdminLike}
      />
    </Suspense>
  )
}
