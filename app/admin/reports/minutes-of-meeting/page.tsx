import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canOverrideReportsWeekLock, resolveAdminScope } from "@/lib/admin/rbac"
import { MeetingDocumentTypeTable } from "@/components/reports/meeting-document-type-table"

export default async function AdminMinutesOfMeetingPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const role = String(profile?.role || "").toLowerCase()
  if (!["developer", "super_admin", "admin"].includes(role)) redirect("/admin/reports/general-meeting")

  const scope = await resolveAdminScope(supabase, user.id)

  return (
    <MeetingDocumentTypeTable
      documentType="minutes"
      title="Minutes of Meeting"
      description="Upload and manage Minutes of Meeting PDFs by week."
      backHref="/admin/reports/general-meeting"
      backLabel="Back to General Meeting"
      canOverrideWeekLock={scope ? canOverrideReportsWeekLock(scope) : false}
    />
  )
}
