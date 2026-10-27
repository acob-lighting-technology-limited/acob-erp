import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AdminHelpDeskContent } from "./management/admin-help-desk-content"
import { expandDepartmentScopeForQuery, getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { loadHelpDeskConsole } from "./_lib/load-help-desk"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin Help Desk Workflow" }

export default async function AdminHelpDeskPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) redirect("/profile")
  const departmentScope = getDepartmentScope(scope, "general")

  const data = await loadHelpDeskConsole(
    getServiceRoleClientOrFallback(supabase),
    departmentScope ? expandDepartmentScopeForQuery(departmentScope) : null
  )

  return (
    <AdminHelpDeskContent
      initialTickets={data.tickets}
      employees={data.employees}
      leadDirectory={data.leadDirectory}
      viewer={{
        id: user.id,
        role: scope.role,
        department: scope.department,
        is_department_lead: scope.isDepartmentLead,
        lead_departments: scope.leadDepartments,
        managed_departments: scope.managedDepartments,
      }}
    />
  )
}
