import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { PortfoliosContent } from "./_components/portfolios-content"

export const metadata: Metadata = {
  title: "Project Portfolios | Matrix",
  description: "Programmes and client groupings holding the company's project portfolio.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function AdminPortfoliosPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) redirect("/profile")

  // Project manager options for creating a project straight into a portfolio —
  // the same active-staff list /admin/project offers.
  const { data: profiles, error: profilesError } = await getServiceRoleClientOrFallback(supabase as DbClient)
    .from("profiles")
    .select("id, first_name, last_name, full_name, department")
    .neq("employment_status", "exited")
    .order("first_name", { ascending: true })

  if (profilesError) {
    console.error("Error loading profiles for project manager assignment:", profilesError)
  }

  const managerOptions = (profiles || []).map((profile) => ({
    id: profile.id,
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    full_name: profile.full_name,
    department: profile.department || "",
  }))

  return <PortfoliosContent profiles={managerOptions} />
}
