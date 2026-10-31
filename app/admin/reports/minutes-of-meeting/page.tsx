import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canOverrideReportsWeekLock, resolveAdminScope } from "@/lib/admin/rbac"
import { MinutesOfMeetingView } from "@/components/reports/minutes-of-meeting-view"

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
    <MinutesOfMeetingView
      backHref="/admin/reports/general-meeting"
      backLabel="Back to General Meeting"
      canOverrideWeekLock={scope ? canOverrideReportsWeekLock(scope) : false}
    />
  )
}
