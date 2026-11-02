import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import WeeklyReportsPortal from "./page-client"

export const metadata: Metadata = { title: "Weekly Reports" }

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The full meeting deck pulls every department's report and the HR birthday
  // list, so — as on the General Meeting hub — it is offered to admins only.
  const canExportFullMeeting = user ? Boolean(await resolveAdminScope(supabase, user.id)) : false

  return <WeeklyReportsPortal canExportFullMeeting={canExportFullMeeting} />
}
