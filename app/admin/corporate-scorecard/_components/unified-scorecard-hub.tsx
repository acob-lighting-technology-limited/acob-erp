"use client"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { BarChart3, Building2, ClipboardList } from "lucide-react"
import type { DataTableTab } from "@/components/ui/data-table"
import { CorporateScorecardRegister } from "./corporate-scorecard-register"
import { DepartmentCascadeContent } from "./department-cascade-content"
import { ScorecardSummaryContent } from "./scorecard-summary-content"

type TabKey = "register" | "department" | "summary"

export const SCORECARD_TABS: DataTableTab[] = [
  { key: "register", label: "Master KPI Register", icon: ClipboardList },
  { key: "department", label: "Department KPIs", icon: Building2 },
  { key: "summary", label: "Executive Summary", icon: BarChart3 },
]

interface UnifiedScorecardHubProps {
  departments: string[]
  initialDepartment?: string | null
  initialTab?: TabKey
}

export function UnifiedScorecardHub({
  departments,
  initialDepartment,
  initialTab = "register",
}: UnifiedScorecardHubProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as TabKey | null
  const deptParam = searchParams.get("department")

  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam === "department" || tabParam === "summary" ? tabParam : initialTab
  )
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    deptParam || initialDepartment || departments[0] || null
  )

  function handleTabChange(nextTab: string) {
    const tabKey = nextTab as TabKey
    setActiveTab(tabKey)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tabKey)
    if (selectedDepartment && tabKey === "department") {
      params.set("department", selectedDepartment)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleSelectDepartmentFromSummary(dept: string) {
    setSelectedDepartment(dept)
    setActiveTab("department")
    const params = new URLSearchParams()
    params.set("tab", "department")
    params.set("department", dept)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <>
      {activeTab === "register" && (
        <CorporateScorecardRegister tabs={SCORECARD_TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {activeTab === "department" && (
        <DepartmentCascadeContent
          departments={departments}
          initialDepartment={selectedDepartment}
          backLink={{ href: "/admin", label: "Back to Admin" }}
          tabs={SCORECARD_TABS}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      {activeTab === "summary" && (
        <ScorecardSummaryContent
          onSelectDepartment={handleSelectDepartmentFromSummary}
          tabs={SCORECARD_TABS}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
    </>
  )
}
