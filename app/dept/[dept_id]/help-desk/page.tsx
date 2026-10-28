import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { normalizeDepartmentName } from "@/shared/departments"
import { AdminHelpDeskContent } from "@/app/admin/help-desk/management/admin-help-desk-content"
import type { Metadata } from "next"
import { loadHelpDeskConsole } from "@/app/admin/help-desk/_lib/load-help-desk"

export const metadata: Metadata = { title: "Dept Help Desk" }

interface DeptHelpDeskPageProps {
  params: Promise<{ dept_id: string }>
}

export default async function DeptHelpDeskPage({ params }: DeptHelpDeskPageProps) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect("/auth/login")

  const data = await loadHelpDeskConsole(getServiceRoleClientOrFallback(supabase), [
    normalizeDepartmentName(scope.deptName),
  ])

  return (
    <AdminHelpDeskContent
      initialTickets={data.tickets}
      employees={data.employees}
      leadDirectory={data.leadDirectory}
      viewer={{
        id: authData.user.id,
        role: scope.role,
        department: scope.deptName,
        is_department_lead: true,
        lead_departments: [scope.deptName],
        managed_departments: [scope.deptName],
      }}
      lockedDepartment={scope.deptName}
      backLinkHref={`/dept/${dept_id}`}
    />
  )
}
