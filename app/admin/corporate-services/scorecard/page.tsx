import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { UnifiedScorecardHub } from "@/app/admin/corporate-scorecard/_components/unified-scorecard-hub"

export const metadata: Metadata = {
  title: "Corporate Scorecard | Corporate Services | Matrix",
  description: "The 2026 strategic plan's corporate KPIs, department execution, and executive summary.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function CorporateServicesScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: "register" | "department" | "summary"; department?: string }>
}) {
  const { tab, department } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) redirect("/profile")

  const { data: departmentRows } = await supabase.from("departments").select("name").eq("is_active", true).order("name")

  return (
    <UnifiedScorecardHub
      departments={(departmentRows || []).map((d) => d.name)}
      initialDepartment={department || null}
      initialTab={tab || "register"}
    />
  )
}
