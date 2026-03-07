import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { ActionTrackerContent } from "./action-tracker-content"
import { resolveAdminScope } from "@/lib/admin/rbac"

export default async function ActionTrackerPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase as any)

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

  // Fetch departments for filtering
  const { data: employeeData } = await dataClient.from("profiles").select("department").not("department", "is", null)

  const departments = Array.from(new Set(employeeData?.map((s: any) => s.department).filter(Boolean))) as string[]
  departments.sort()

  return (
    <Suspense fallback={<div className="flex justify-center py-20">Loading Tracker...</div>}>
      <ActionTrackerContent initialDepartments={departments} scopedDepartments={scope.managedDepartments || []} />
    </Suspense>
  )
}
