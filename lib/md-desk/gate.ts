import "server-only"
import { redirect } from "next/navigation"
import { getEventsSession } from "@/lib/events/server"
import { loadMdDeskAccess } from "@/lib/md-desk/server"

/**
 * Every MD's Desk page is limited to the MD, people acting for the MD or holding an override
 * (admin_edit_grants on mddesk.main), and, for now, super admins and developers looking only
 * (see MdDeskAccess.canView). Middleware
 * lets any admin-shell user reach /admin/md-desk/* (mddesk.main), so this is the
 * real gate; `fallback` is where non-members are sent.
 */
export async function requireMdDeskMember(fallback: "/admin" | "/profile"): Promise<void> {
  const session = await getEventsSession()
  if (!session) redirect("/auth/login")
  const access = await loadMdDeskAccess(session)
  if (!access.canView) redirect(fallback)
}
