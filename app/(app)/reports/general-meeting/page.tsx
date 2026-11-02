import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import PortalGeneralMeetingPage from "./page-client"

export const metadata: Metadata = { title: "General Meeting" }

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The agenda deck pulls every department's report and the HR birthday list,
  // so it is offered to admins only — the same people who run the meeting.
  const canExportAgendaDeck = user ? Boolean(await resolveAdminScope(supabase, user.id)) : false

  return <PortalGeneralMeetingPage canExportAgendaDeck={canExportAgendaDeck} />
}
