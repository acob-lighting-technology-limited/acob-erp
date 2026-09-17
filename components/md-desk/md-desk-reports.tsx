"use client"

import Link from "next/link"
import { ChevronRight, ClipboardCheck, FileBarChart, FileText, ShieldAlert, Target, Users } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"

/**
 * MD's Desk → Reports. A hub, not a copy: each card opens the existing report
 * screen, so there is one source for every report.
 */
const REPORTS = [
  {
    title: "Weekly Reports",
    description: "Department weekly reports for the general meeting.",
    href: "/admin/reports/general-meeting/weekly-reports",
    icon: FileBarChart,
  },
  {
    title: "Action Tracker",
    description: "Actions agreed at meetings and their progress.",
    href: "/admin/reports/action-tracker",
    icon: ClipboardCheck,
  },
  {
    title: "Minutes of Meeting",
    description: "Recorded minutes from general meetings.",
    href: "/admin/reports/minutes-of-meeting",
    icon: FileText,
  },
  {
    title: "KSS",
    description: "Knowledge sharing sessions by department.",
    href: "/admin/reports/kss",
    icon: Users,
  },
  {
    title: "Corporate Scorecard",
    description: "Company objectives and department cascade.",
    href: "/admin/corporate-scorecard",
    icon: Target,
  },
  {
    title: "Risk Register",
    description: "Corporate risks, owners and mitigation status.",
    href: "/admin/corporate-services/risk-register",
    icon: ShieldAlert,
  },
]

export function MdDeskReports({ basePath }: { basePath: string }) {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Reports"
        description="The reports the MD reviews, in one place."
        icon={FileBarChart}
        backLink={{ href: basePath, label: "Back to MD's Desk" }}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <Link key={report.href} href={report.href} className="group block">
            <div className="bg-card hover:border-primary/50 flex h-full items-start gap-3 rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <report.icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{report.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{report.description}</p>
              </div>
              <ChevronRight
                className="text-muted-foreground mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
          </Link>
        ))}
      </div>
    </PageWrapper>
  )
}
