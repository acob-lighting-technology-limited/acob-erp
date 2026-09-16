"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BarChart2, Building2, Target } from "lucide-react"
import { PmsTablePage } from "@/app/admin/hr/pms/_components/pms-table-page"
import type { DataTableTab } from "@/components/ui/data-table"
import { DepartmentCascadeContent } from "@/app/admin/corporate-scorecard/_components/department-cascade-content"
import type { ReviewCycleOption } from "@/app/(app)/pms/_lib"

const KPI_TABS: DataTableTab[] = [
  { key: "appraisal", label: "My Scored Work & Appraisal", icon: BarChart2 },
  { key: "department_kpis", label: "Department Corporate KPIs", icon: Target },
]

interface EmployeeKpiTabsProps {
  department: string | null
  initialTab?: string
  cycles: ReviewCycleOption[]
  activeCycleId: string | null
  kpiScore: number | null
  approvedGoals: number
  completedGoals: number
  cycleName: string
  rows: Array<Record<string, unknown>>
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "-"
}

export function EmployeeKpiTabs({
  department,
  initialTab,
  cycles,
  activeCycleId,
  kpiScore,
  approvedGoals,
  completedGoals,
  cycleName,
  rows,
}: EmployeeKpiTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentTab = searchParams.get("tab") || initialTab || "appraisal"
  const activeTab = currentTab === "department_kpis" ? "department_kpis" : "appraisal"

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "appraisal") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }

  if (activeTab === "department_kpis") {
    if (department) {
      return (
        <DepartmentCascadeContent
          departments={[department]}
          initialDepartment={department}
          lockedDepartment={department}
          backLink={{ href: "/pms", label: "Back to PMS" }}
          isReadOnly={true}
          tabs={KPI_TABS}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )
    }

    return (
      <PmsTablePage
        title="PMS KPI"
        description="Track your goal progress, task weights, and effective KPI attainment for the review cycle."
        backHref="/pms"
        backLabel="Back to PMS"
        icon="kpi"
        tabs={KPI_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        cycles={cycles}
        activeCycleId={activeCycleId}
        tableTitle="Department Corporate KPIs"
        tableDescription=""
        rows={[]}
        columns={[]}
      >
        <div className="bg-card mx-auto my-12 max-w-md rounded-xl border p-8 text-center shadow-sm">
          <Building2 className="text-muted-foreground mx-auto h-10 w-10" />
          <h3 className="mt-4 text-base font-semibold">No Department Assigned</h3>
          <p className="text-muted-foreground mt-2 text-xs">
            Your user profile does not have a department set. Contact HR or an administrator to assign your department
            to view your departmental Corporate KPIs.
          </p>
        </div>
      </PmsTablePage>
    )
  }

  return (
    <PmsTablePage
      title="PMS KPI"
      description="Track your goal progress, task weights, and effective KPI attainment for the review cycle."
      backHref="/pms"
      backLabel="Back to PMS"
      icon="kpi"
      tabs={KPI_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      cycles={cycles}
      activeCycleId={activeCycleId}
      summaryCards={[
        { label: "KPI Score", value: formatPercent(kpiScore) },
        { label: "Approved Goals", value: approvedGoals },
        { label: "Completed Goals", value: completedGoals },
      ]}
      tableTitle="KPI Task Breakdown"
      tableDescription={`Your scored tasks in ${cycleName}, grouped by goal. Each task earns its weight multiplied by its rating out of 5; tasks with no goal are grouped as ad-hoc.`}
      rows={rows}
      columns={[
        { key: "cycle", label: "Cycle" },
        { key: "rating", label: "Rating" },
        { key: "earned", label: "Earned" },
        { key: "effective_kpi_pct", label: "Effective KPI" },
        { key: "linked_tasks", label: "Completed / Scored" },
        { key: "weight", label: "Total Weight" },
      ]}
      searchPlaceholder="Search cycle or rating..."
      filterKey="cycle"
      filterLabel="Cycle"
      filterAllLabel="All Cycles"
    />
  )
}
