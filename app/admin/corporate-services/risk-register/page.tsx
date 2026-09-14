import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { RiskRegisterView } from "./_components/risk-register-view"

export const metadata: Metadata = {
  title: "Risk Register | Corporate Services | Matrix",
  description: "Enterprise and departmental risk matrix, tracking operational challenges and strategic mitigations.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function RiskRegisterPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) redirect("/profile")

  const [departmentsRes, profilesRes] = await Promise.all([
    supabase.from("departments").select("name").eq("is_active", true).order("name"),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email:company_email")
      .eq("employment_status", "active")
      .order("first_name"),
  ])

  const departments = (departmentsRes.data || []).map((d) => d.name)
  const employees = profilesRes.data || []

  return <RiskRegisterView departments={departments} employees={employees} userRole={scope.role} />
}
