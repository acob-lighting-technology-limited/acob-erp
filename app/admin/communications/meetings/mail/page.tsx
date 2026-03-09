import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WeeklySummaryContent } from "@/app/admin/reports/mail/weekly-summary-content"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"

export default async function CommunicationsMeetingsMailPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, department")
    .eq("id", user.id)
    .single()

  if (!profile || !["developer", "super_admin", "admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  const { data: employees } = await applyAssignableStatusFilter(
    supabase
      .from("profiles")
      .select("id, full_name, company_email, additional_email, department, employment_status")
      .or("company_email.not.is.null,additional_email.not.is.null")
      .order("full_name"),
    { allowLegacyNullStatus: false }
  )

  return (
    <WeeklySummaryContent
      employees={employees || []}
      currentUser={{
        id: user.id,
        full_name: profile?.full_name || null,
        department: profile?.department || null,
      }}
    />
  )
}
