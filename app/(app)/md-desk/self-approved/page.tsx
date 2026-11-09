import type { Metadata } from "next"
import { MdDeskSelfApproved } from "@/components/md-desk/md-desk-self-approved"
import { loadRecentSelfApprovedAppeals } from "@/lib/hr/self-approved"
import { requireMdDeskMember } from "@/lib/md-desk/gate"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Self-approved Appeals" }

export const dynamic = "force-dynamic"

export default async function MdDeskSelfApprovedPage() {
  await requireMdDeskMember("/profile")
  const supabase = await createClient()
  const rows = await loadRecentSelfApprovedAppeals(getServiceRoleClientOrFallback(supabase))
  return <MdDeskSelfApproved rows={rows} />
}
