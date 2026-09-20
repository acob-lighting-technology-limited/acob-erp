"use client"

import { useState } from "react"
import { BarChart2, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DepartmentCascadeContent } from "@/app/admin/corporate-scorecard/_components/department-cascade-content"
import { PmsMetricTabsPage } from "@/app/admin/pms/_components/pms-metric-tabs-page"

interface DeptPmsKpiViewProps {
  deptId: string
  deptName: string
}

export function DeptPmsKpiView({ deptId, deptName }: DeptPmsKpiViewProps) {
  const [activeTab, setActiveTab] = useState<"department_kpis" | "appraisal_scores">("department_kpis")

  return (
    <div className="space-y-4">
      <div className="bg-card/60 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === "department_kpis" ? "default" : "outline"}
              onClick={() => setActiveTab("department_kpis")}
            >
              <Target className="mr-1.5 h-4 w-4" />
              Department Scorecard & KPIs
            </Button>
            <Button
              size="sm"
              variant={activeTab === "appraisal_scores" ? "default" : "outline"}
              onClick={() => setActiveTab("appraisal_scores")}
            >
              <BarChart2 className="mr-1.5 h-4 w-4" />
              Quarterly Appraisal Scores
            </Button>
          </div>
          <span className="text-muted-foreground hidden text-xs sm:inline-block">
            {activeTab === "department_kpis"
              ? `Core & Support KPIs, targets, and progress for ${deptName}`
              : `Quarterly appraisal scoring for ${deptName} staff`}
          </span>
        </div>
      </div>

      {activeTab === "department_kpis" ? (
        <DepartmentCascadeContent
          departments={[deptName]}
          initialDepartment={deptName}
          lockedDepartment={deptName}
          backLink={{ href: `/dept/${deptId}/hr/pms`, label: "Back to PMS" }}
        />
      ) : (
        <PmsMetricTabsPage
          metric="kpi"
          title="PMS KPI"
          description={`KPI appraisal scores for ${deptName}`}
          iconKey="kpi"
          backLinkHref={`/dept/${deptId}/hr/pms`}
          attendanceBasePath={`/dept/${deptId}/hr/attendance`}
        />
      )}
    </div>
  )
}
