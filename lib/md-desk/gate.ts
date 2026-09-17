import "server-only"
import { redirect } from "next/navigation"
import { getEventsSession } from "@/lib/events/server"
import { loadMdDeskAccess } from "@/lib/md-desk/server"

/**
 * Every MD's Desk page is limited to the MD, md_desk_delegates, super admins and
 * developers (see MdDeskAccess.canView). Middleware
 * lets any admin-shell user reach /admin/md-desk/* (mddesk.main), so this is the
 * real gate; `fallback` is where non-members are sent.
 */
export async function requireMdDeskMember(fallback: "/admin" | "/profile"): Promise<void> {
  const session = await getEventsSession()
  if (!session) redirect("/auth/login")
  const access = await loadMdDeskAccess(session)
  if (!access.canView) redirect(fallback)
}
