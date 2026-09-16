import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { isAdminLikeRole } from "@/lib/admin/rbac"
import { PortfoliosContent } from "@/app/admin/portfolios/_components/portfolios-content"

export const metadata: Metadata = {
  title: "Project Portfolios | Matrix",
  description: "Programmes and client groupings holding the company's project portfolio.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

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

  const isAdmin = isAdminLikeRole(profile?.role) || Boolean(profile?.is_department_lead)

  const { data: profiles, error: profilesError } = await getServiceRoleClientOrFallback(supabase as DbClient)
    .from("profiles")
    .select("id, first_name, last_name, full_name, department")
    .neq("employment_status", "exited")
    .order("first_name", { ascending: true })

  if (profilesError) {
    console.error("Error loading profiles for project manager assignment:", profilesError)
  }

  const managerOptions = (profiles || []).map((p) => ({
    id: p.id,
    first_name: p.first_name || "",
    last_name: p.last_name || "",
    full_name: p.full_name,
    department: p.department || "",
  }))

  return <PortfoliosContent isAdmin={isAdmin} profiles={managerOptions} />
}
