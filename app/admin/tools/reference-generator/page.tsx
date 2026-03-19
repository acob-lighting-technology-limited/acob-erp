import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AdminCorrespondenceContent } from "../../correspondence/admin-correspondence-content"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import type { CorrespondenceRecord } from "@/types/correspondence"

type EmployeeRow = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
  role: string | null
}

type DepartmentCodeRow = {
  department_name: string
  department_code: string
  is_active: boolean
}

async function getData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { redirectTo: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) {
    return { redirectTo: "/profile" as const }
  }

  const departmentScope = getDepartmentScope(scope, "general")

  const recordsQuery = dataClient.from("correspondence_records").select("*").order("created_at", { ascending: false })

  let employeesQuery = dataClient
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
    employeesQuery.returns<EmployeeRow[]>(),
    dataClient
      .from("correspondence_department_codes")
      .select("department_name, department_code, is_active")
      .order("department_name", { ascending: true })
      .returns<DepartmentCodeRow[]>(),
  ])

  const scopedRecords =
    departmentScope && departmentScope.length > 0
      ? (records || []).filter(
          (record: CorrespondenceRecord) =>
            departmentScope.includes(record.department_name || "") ||
            departmentScope.includes(record.assigned_department_name || "")
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

export default async function AdminReferenceGeneratorPage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return (
    <AdminCorrespondenceContent
      initialRecords={data.records}
      employees={data.employees}
      departmentCodes={data.departmentCodes}
    />
  )
}
