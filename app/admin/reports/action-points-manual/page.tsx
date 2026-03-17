import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MeetingDocumentTypeTable } from "@/components/reports/meeting-document-type-table"

export default async function AdminActionPointsManualPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const role = String(profile?.role || "").toLowerCase()
  if (!["developer", "super_admin", "admin"].includes(role)) redirect("/admin/reports")

  return (
    <MeetingDocumentTypeTable
      documentType="action_points"
      title="Action Points (Manual)"
      description="Upload and manage manual Action Points PDFs by week."
      backHref="/admin/reports"
      backLabel="Back to Reports"
    />
  )
}
