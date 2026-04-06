import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MeetingDocumentTypeTable } from "@/components/reports/meeting-document-type-table"

export default async function DashboardMinutesOfMeetingPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/auth/login")

  return (
    <MeetingDocumentTypeTable
      documentType="minutes"
      title="Minutes of Meeting"
      description="Upload and manage Minutes of Meeting PDFs by week."
      backHref="/reports/general-meeting"
      backLabel="Back to General Meeting"
      readOnly
    />
  )
}
