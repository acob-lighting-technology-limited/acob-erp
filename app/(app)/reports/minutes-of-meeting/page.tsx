import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MinutesOfMeetingView } from "@/components/reports/minutes-of-meeting-view"

export default async function DashboardMinutesOfMeetingPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/auth/login")

  return <MinutesOfMeetingView backHref="/reports/general-meeting" backLabel="Back to General Meeting" readOnly />
}
