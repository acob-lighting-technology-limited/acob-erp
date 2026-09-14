"use client"

import { useState } from "react"
import { BarChart2, Building2, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DepartmentCascadeContent } from "@/app/admin/corporate-scorecard/_components/department-cascade-content"

interface EmployeeKpiTabsProps {
  department: string | null
  children: React.ReactNode
}

export function EmployeeKpiTabs({ department, children }: EmployeeKpiTabsProps) {
  const [activeTab, setActiveTab] = useState<"department_kpis" | "appraisal">("department_kpis")

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
              Department Corporate KPIs
            </Button>
            <Button
              size="sm"
              variant={activeTab === "appraisal" ? "default" : "outline"}
              onClick={() => setActiveTab("appraisal")}
            >
              <BarChart2 className="mr-1.5 h-4 w-4" />
              My Scored Work & Appraisal
            </Button>
          </div>
          <span className="text-muted-foreground hidden text-xs sm:inline-block">
            {activeTab === "department_kpis"
              ? department
                ? `Core & Support KPIs for ${department}`
                : "No department assigned to profile"
              : "Review cycle goal breakdown and task score attainment"}
          </span>
        </div>
      </div>

      {activeTab === "department_kpis" ? (
        department ? (
          <DepartmentCascadeContent
            departments={[department]}
            initialDepartment={department}
            lockedDepartment={department}
            backLink={{ href: "/pms", label: "Back to PMS" }}
            isReadOnly={true}
          />
        ) : (
          <div className="bg-card mx-auto max-w-md rounded-xl border p-8 text-center shadow-sm">
            <Building2 className="text-muted-foreground mx-auto h-10 w-10" />
            <h3 className="mt-4 text-base font-semibold">No Department Assigned</h3>
            <p className="text-muted-foreground mt-2 text-xs">
              Your user profile does not have a department set. Contact HR or an administrator to assign your department
              to view your departmental Corporate KPIs.
            </p>
          </div>
        )
      ) : (
        children
      )}
    </div>
  )
}
