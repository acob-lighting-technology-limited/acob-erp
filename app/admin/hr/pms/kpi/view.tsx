"use client"

import { useState } from "react"
import { BarChart2, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PmsMetricTabsPage } from "../_components/pms-metric-tabs-page"
import { CorporateScorecardRegister } from "@/app/admin/corporate-scorecard/_components/corporate-scorecard-register"

export function AdminPmsKpiPage({
  backLinkHref,
  attendanceBasePath,
}: { backLinkHref?: string; attendanceBasePath?: string } = {}) {
  const [activeTab, setActiveTab] = useState<"master_kpis" | "appraisal_scores">("master_kpis")

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
              variant={activeTab === "appraisal_scores" ? "default" : "outline"}
              onClick={() => setActiveTab("appraisal_scores")}
            >
              <BarChart2 className="mr-1.5 h-4 w-4" />
              Cycle Appraisal Scores
            </Button>
          </div>
          <span className="text-muted-foreground hidden text-xs sm:inline-block">
            {activeTab === "master_kpis"
              ? "Master catalog of 2026 corporate KPIs, strategic pillars, and RACI ownership"
              : "Employee and departmental appraisal score calculations"}
          </span>
        </div>
      </div>

      {activeTab === "master_kpis" ? (
        <CorporateScorecardRegister />
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
