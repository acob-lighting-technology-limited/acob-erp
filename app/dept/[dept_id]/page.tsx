/**
 * Dept Console dashboard.
 *
 * A thin wrapper: the queries live in `loadDashboardData` and the layout in `DashboardView`, the same two
 * the admin dashboard uses, scoped here to this department. Change the dashboard there, not here.
 */
import type { Metadata } from "next"
import { Building2, FileText, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireDeptScope } from "@/lib/dept/require-dept-scope"
import { expandDepartmentScopeForQuery } from "@/lib/admin/rbac"
import { loadDashboardData } from "@/lib/admin/dashboard-data"
import { normalizeDepartmentName } from "@/shared/departments"
import { formatName } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { DashboardView } from "@/components/admin/dashboard-view"

export const metadata: Metadata = { title: "Dept overview" }

const log = logger("dept-dashboard")

interface DeptOverviewPageProps {
  params: Promise<{ dept_id: string }>
}

export default async function DeptOverviewPage({ params }: DeptOverviewPageProps) {
  const { dept_id } = await params
  const scope = await requireDeptScope(dept_id)

  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)

  const deptName = normalizeDepartmentName(scope.deptName)
  const queryDepartmentScope = expandDepartmentScopeForQuery([deptName])

  const data = await loadDashboardData({
    dataClient,
    userId: scope.userId,
    departmentScope: [deptName],
    canSeeAuditActivity: true,
  })

  // The two totals the shared "Today" row has no equivalent for.
  const [{ data: profileIdRows }, assetStats] = await Promise.all([
    dataClient.from("profiles").select("id").in("department", queryDepartmentScope),
    dataClient
      .from("assets")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("department", queryDepartmentScope),
  ])
  if (assetStats.error) log.error("assets count failed", assetStats.error)
  const scopedUserIds = ((profileIdRows || []) as { id: string }[]).map((row) => row.id)
  const docStats =
    scopedUserIds.length > 0
      ? await dataClient
          .from("user_documentation")
          .select("*", { count: "exact", head: true })
          .in("user_id", scopedUserIds)
      : { count: 0 }

  return (
    <DashboardView
      data={data}
      title={`${scope.deptName} Dashboard`}
      description={`Department overview for ${formatName(data.firstName) || "Lead"}. Here is what needs action in your team.`}
      icon={Building2}
      basePath={`/dept/${dept_id}`}
      // Each dept page runs its own guard, so a lead is not pre-filtered here.
      canAccess={() => true}
      showAuditActivity
      extraStats={
        <Section title="Department totals" description="Inventory and documentation held by this department.">
          <StatGrid>
            <StatCard
              variant="compact"
              title="Assets"
              value={assetStats.count || 0}
              description="Tracked dept inventory"
              icon={Package}
              iconBgColor="bg-purple/15"
              iconColor="text-purple"
            />
            <StatCard
              variant="compact"
              title="Documents"
              value={docStats.count || 0}
              description="Team documentation"
              icon={FileText}
              iconBgColor="bg-warning/15"
              iconColor="text-warning"
            />
          </StatGrid>
        </Section>
      }
    />
  )
}
