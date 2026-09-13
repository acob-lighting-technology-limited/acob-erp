"use client"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { BarChart3, Building2, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CorporateScorecardRegister } from "./corporate-scorecard-register"
import { DepartmentCascadeContent } from "./department-cascade-content"
import { ScorecardSummaryContent } from "./scorecard-summary-content"

type TabKey = "register" | "department" | "summary"

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

  function handleTabChange(nextTab: TabKey) {
    setActiveTab(nextTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", nextTab)
    if (selectedDepartment && nextTab === "department") {
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
    <div className="space-y-4">
      {/* Consolidated Strategy & Scorecard Navigation Header */}
      <div className="bg-card/60 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === "register" ? "default" : "outline"}
              onClick={() => handleTabChange("register")}
            >
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Master KPI Register
            </Button>
            <Button
              size="sm"
              variant={activeTab === "department" ? "default" : "outline"}
              onClick={() => handleTabChange("department")}
            >
              <Building2 className="mr-1.5 h-4 w-4" />
              Department KPIs
            </Button>
            <Button
              size="sm"
              variant={activeTab === "summary" ? "default" : "outline"}
              onClick={() => handleTabChange("summary")}
            >
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Executive Summary
            </Button>
          </div>
          <span className="text-muted-foreground hidden text-xs md:inline-block">
            {activeTab === "register" && "All 61 master strategic KPIs, pillars, and RACI ownership"}
            {activeTab === "department" && "Department quotas, confirmed targets, actions, and progress actuals"}
            {activeTab === "summary" && "Executive rollup by the 4 BSC perspectives and company attainment"}
          </span>
        </div>
      </div>

      {activeTab === "register" && <CorporateScorecardRegister />}

      {activeTab === "department" && (
        <DepartmentCascadeContent
          departments={departments}
          initialDepartment={selectedDepartment}
          backLink={{ href: "/admin", label: "Back to Admin" }}
        />
      )}

      {activeTab === "summary" && <ScorecardSummaryContent onSelectDepartment={handleSelectDepartmentFromSummary} />}
    </div>
  )
}
