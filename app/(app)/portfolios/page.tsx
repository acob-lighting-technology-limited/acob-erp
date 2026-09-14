import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { isAdminLikeRole } from "@/lib/admin/rbac"
import { PortfoliosContent } from "@/app/admin/portfolios/_components/portfolios-content"

export const metadata: Metadata = {
  title: "Project Portfolios | Matrix",
  description: "Programmes and client groupings holding the company's project portfolio.",
}

export default async function AppPortfoliosPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_department_lead")
    .eq("id", user.id)
    .single()

  const isAdmin = isAdminLikeRole(profile?.role)

  return <PortfoliosContent isAdmin={isAdmin} />
}
