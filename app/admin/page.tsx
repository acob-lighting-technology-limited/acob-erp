import { redirect } from "next/navigation"
import { Shield } from "lucide-react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { buildAccessContextV2, canAccessRouteV2, resolveAdminRouteKeyV2 } from "@/lib/admin/policy-v2"
import { loadDashboardData } from "@/lib/admin/dashboard-data"
import { formatName } from "@/lib/utils"
import { DashboardView } from "@/components/admin/dashboard-view"

export const metadata: Metadata = { title: "Admin Dashboard" }

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // The admin layout redirects these cases too, but layouts and pages render in parallel, so this
  // page's service-role queries would still run. A null department scope means "unrestricted",
  // which a missing admin scope must never be mistaken for.
  if (!user) redirect("/auth/login")
  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) redirect("/profile")

  const canSeeAuditActivity = Boolean(scope.isAdminLike || scope.isDepartmentLead)
  const data = await loadDashboardData({
    dataClient,
    userId: user.id,
    departmentScope: getDepartmentScope(scope, "general"),
    canSeeAuditActivity,
  })

  const accessContext = buildAccessContextV2(scope)
  const canAccess = (href: string) => canAccessRouteV2(accessContext, resolveAdminRouteKeyV2(href))

  return (
    <DashboardView
      data={data}
      title="Admin Dashboard"
      description={`Welcome back, ${formatName(data.firstName) || "Admin"}. Here is what needs action across your scope.`}
      icon={Shield}
      basePath="/admin"
      canAccess={canAccess}
      showAuditActivity={canSeeAuditActivity}
    />
  )
}
