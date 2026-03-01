import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminCorrespondenceContent } from "./admin-correspondence-content"
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

  const recordsQuery = supabase.from("correspondence_records").select("*").order("created_at", { ascending: false })

  let employeesQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, department, role")
    .order("last_name", { ascending: true })

  if (departmentScope) {
    employeesQuery =
      departmentScope.length > 0
        ? employeesQuery.in("department", departmentScope)
        : employeesQuery.eq("id", "__none__")
  }

  const [{ data: records }, { data: employees }, { data: departmentCodes }] = await Promise.all([
    recordsQuery,
    employeesQuery,
    supabase
      .from("correspondence_department_codes")
      .select("department_name, department_code, is_active")
      .order("department_name", { ascending: true }),
  ])

  const scopedRecords =
    departmentScope && departmentScope.length > 0
      ? (records || []).filter(
          (record: any) =>
            departmentScope.includes(record.department_name) ||
            departmentScope.includes(record.assigned_department_name)
        )
      : departmentScope
        ? []
        : records || []

  return {
    records: scopedRecords,
    employees: employees || [],
    departmentCodes: departmentCodes || [],
  }
}

export default async function AdminCorrespondencePage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return (
    <AdminCorrespondenceContent
      initialRecords={data.records as any}
      employees={data.employees as any}
      departmentCodes={data.departmentCodes as any}
    />
  )
}
