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

// Staff-shell entry so a PA who is not an admin can use MD's Desk. Same gate as
// /admin/md-desk: the MD and md_desk_delegates only.
export default async function MdDeskPage() {
  const session = await getEventsSession()
  if (!session) redirect("/auth/login")
  const access = await loadMdDeskAccess(session)
  if (!access.isMember) redirect("/profile")
  return <MdDeskWorkspace />
}
