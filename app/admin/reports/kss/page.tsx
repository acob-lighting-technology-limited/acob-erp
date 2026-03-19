import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAssignableEmploymentStatus } from "@/lib/workforce/assignment-policy"
import { KssRosterTable } from "@/components/reports/kss-roster-table"

export default async function AdminKssPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_department_lead")
    .eq("id", user.id)
    .single()

  const role = String(profile?.role || "").toLowerCase()
  const isAllowed = ["developer", "super_admin", "admin"].includes(role) || profile?.is_department_lead === true
  if (!isAllowed) redirect("/admin/reports")

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, department, employment_status")
    .order("full_name")

  const assignableEmployees = (employees || []).filter((employee) =>
    isAssignableEmploymentStatus(employee.employment_status, { allowLegacyNullStatus: false })
  )

  return (
    <KssRosterTable
      employees={assignableEmployees.map((e: { id: string; full_name: string; department: string | null }) => ({
        id: e.id,
        full_name: e.full_name,
        department: e.department,
      }))}
      backHref="/admin/reports"
      backLabel="Back to Reports"
      title="Knowledge Sharing Session"
    />
  )
}
