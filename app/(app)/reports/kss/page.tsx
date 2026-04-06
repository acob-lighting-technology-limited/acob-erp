import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { KssRosterTable } from "@/components/reports/kss-roster-table"

export default async function DashboardKssPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/auth/login")

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, department")
    .eq("employment_status", "active")
    .order("full_name")
  const employeeRows = (employees || []) as Array<{ id: string; full_name: string; department: string | null }>

  return (
    <KssRosterTable
      employees={employeeRows.map((e) => ({
        id: e.id,
        full_name: e.full_name,
        department: e.department,
      }))}
      backHref="/reports/general-meeting"
      backLabel="Back to General Meeting"
      title="Knowledge Sharing Session"
      currentUserId={user.id}
      readOnly
    />
  )
}
