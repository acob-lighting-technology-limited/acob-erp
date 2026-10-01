"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { BarChart2, Flag, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PmsMetricTabsPage } from "../_components/pms-metric-tabs-page"
import { CorporateScorecardRegister } from "@/app/admin/corporate-scorecard/_components/corporate-scorecard-register"
import { StrategicGoalsView } from "@/app/admin/corporate-scorecard/_components/strategic-goals-view"

export function AdminPmsKpiPage({
  backLinkHref,
  attendanceBasePath,
}: { backLinkHref?: string; attendanceBasePath?: string } = {}) {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<"master_kpis" | "goals" | "appraisal_scores">(() =>
    searchParams.get("tab") === "goals" ? "goals" : "master_kpis"
  )

  return (
    <div className="space-y-4">
      <div className="bg-card/60 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === "master_kpis" ? "default" : "outline"}
              onClick={() => setActiveTab("master_kpis")}
            >
              <Target className="mr-1.5 h-4 w-4" />
              Corporate KPIs Master
            </Button>
            <Button
              size="sm"
              variant={activeTab === "goals" ? "default" : "outline"}
              onClick={() => setActiveTab("goals")}
            >
              <Flag className="mr-1.5 h-4 w-4" />
              Goals
            </Button>
            <Button
              size="sm"
              variant={activeTab === "appraisal_scores" ? "default" : "outline"}
              onClick={() => setActiveTab("appraisal_scores")}
            >
              <BarChart2 className="mr-1.5 h-4 w-4" />
              Cycle Appraisal Scores
            </Button>
          </div>
          <span className="text-muted-foreground hidden text-xs sm:inline-block">
            {activeTab === "master_kpis"
              ? "Master catalog of corporate KPIs, strategic pillars, and RACI ownership"
              : activeTab === "goals"
                ? "Company goals, the work linked to each, and which have none"
                : "Employee and departmental appraisal score calculations"}
          </span>
        </div>
      </div>

      {activeTab === "master_kpis" ? (
        <CorporateScorecardRegister />
      ) : activeTab === "goals" ? (
        <StrategicGoalsView scope="all" backHref={backLinkHref ?? "/admin/pms"} backLabel="Back to PMS" />
      ) : (
        <PmsMetricTabsPage
          metric="kpi"
          title="PMS KPI"
          description="KPI view with individual, department, and cycle tabs."
          iconKey="kpi"
          backLinkHref={backLinkHref}
          attendanceBasePath={attendanceBasePath}
        />
      )}
    </div>
  )
}
