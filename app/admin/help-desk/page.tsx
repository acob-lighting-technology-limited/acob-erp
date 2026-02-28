import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminHelpDeskContent } from "./management/admin-help-desk-content"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"

async function getData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { redirectTo: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    return { redirectTo: "/dashboard" as const }
  }
  const departmentScope = getDepartmentScope(scope, "general")

  let ticketsQuery = supabase.from("help_desk_tickets").select("*").order("created_at", { ascending: false })
  if (departmentScope) {
    ticketsQuery =
      departmentScope.length > 0
        ? ticketsQuery.in("service_department", departmentScope)
        : ticketsQuery.eq("id", "__none__")
  }

  let employeesQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, department")
    .order("last_name", { ascending: true })
  if (departmentScope) {
    employeesQuery =
      departmentScope.length > 0
        ? employeesQuery.in("department", departmentScope)
        : employeesQuery.eq("id", "__none__")
  }

  const [{ data: tickets }, { data: employees }] = await Promise.all([ticketsQuery, employeesQuery])

  return {
    tickets: tickets || [],
    employees: employees || [],
  }
}

export default async function AdminHelpDeskPage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return <AdminHelpDeskContent initialTickets={data.tickets as any} employees={data.employees as any} />
}
