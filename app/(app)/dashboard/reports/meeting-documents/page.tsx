import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"
import { MeetingDocumentLibrary } from "@/components/reports/meeting-document-library"

export default async function DashboardMeetingDocumentsPage() {
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
  if (!isAllowed) redirect("/dashboard/reports")

  const { data: employees } = await applyAssignableStatusFilter(
    supabase.from("profiles").select("id, full_name, department, employment_status").order("full_name"),
    { allowLegacyNullStatus: false }
  )

  return (
    <MeetingDocumentLibrary
      employees={(employees || []).map((e: { id: string; full_name: string; department: string | null }) => ({
        id: e.id,
        full_name: e.full_name,
        department: e.department,
      }))}
      backHref="/dashboard/reports"
      backLabel="Back to Reports"
      title="Meeting Documents"
    />
  )
}
