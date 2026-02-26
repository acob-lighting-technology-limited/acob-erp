import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MeetingRemindersContent } from "@/app/admin/reports/meeting-reminders/meeting-reminders-content"

export default async function CommunicationsMeetingsRemindersPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, company_email, additional_email, department, employment_status")
    .eq("employment_status", "active")
    .or("company_email.not.is.null,additional_email.not.is.null")
    .order("full_name")

  return <MeetingRemindersContent employees={employees || []} mode="meetings" />
}
