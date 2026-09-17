import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { loadAssignableStaff } from "@/lib/projects/staff-options"
import { PortfolioDetail } from "@/components/projects/portfolio-detail"

export const metadata: Metadata = {
  title: "Portfolio | Matrix",
  description: "A portfolio's projects, ranked by what needs attention, and its charts.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function AdminPortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) redirect("/profile")

  const profiles = await loadAssignableStaff(supabase as DbClient)
  return <PortfolioDetail portfolioId={id} isAdmin profiles={profiles} />
}
