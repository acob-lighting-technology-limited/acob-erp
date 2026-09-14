import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { MdDeskWorkspace } from "@/components/md-desk/md-desk-workspace"
import { getEventsSession } from "@/lib/events/server"
import { loadMdDeskAccess } from "@/lib/md-desk/server"

export const metadata: Metadata = {
  title: "MD's Desk | ACOB Lighting Technology Limited",
  description: "The MD's engagements, approvals and delegates.",
}

export const dynamic = "force-dynamic"

// Membership-gated: the MD and md_desk_delegates only. Middleware lets any admin
// shell user reach /admin/md-desk (mddesk.main), so this check is the real gate.
export default async function AdminMdDeskPage() {
  const session = await getEventsSession()
  if (!session) redirect("/auth/login")
  const access = await loadMdDeskAccess(session)
  if (!access.isMember) redirect("/admin")
  return <MdDeskWorkspace backLink={{ href: "/admin", label: "Back to Admin" }} />
}
