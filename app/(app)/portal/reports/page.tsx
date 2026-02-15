"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutDashboard, FileBarChart, ClipboardList, FileText, ChevronRight } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"

export default function PortalReportsPage() {
  const reportCards = [
    {
      title: "Action Tracker",
      description: "Track project progress, pending actions, and status updates.",
      href: "/portal/reports/action-tracker",
      icon: ClipboardList,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Weekly Reports",
      description: "View and submit weekly status updates and performance summaries.",
      href: "/portal/reports/weekly-reports",
      icon: FileText,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Reports Dashboard"
        description="Access project status reports, action tracking tools, and weekly performance summaries."
        icon={FileBarChart}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((card) => (
          <Link key={card.title} href={card.href} className="group">
            <Card className="hover:border-primary h-full border-2 transition-all hover:shadow-lg">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div
                  className={`${card.bgColor} ${card.color} flex h-12 w-12 items-center justify-center rounded-lg transition-transform group-hover:scale-110`}
                >
                  <card.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="group-hover:text-primary text-xl transition-colors">{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-sm leading-relaxed">{card.description}</CardDescription>
                <div className="text-primary flex translate-x-[-10px] items-center text-sm font-medium opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                  Access Tool <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Placeholder for future reports */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex h-full flex-col items-center justify-center py-12 text-center">
            <div className="bg-background mb-4 flex h-12 w-12 items-center justify-center rounded-full border shadow-sm">
              <LayoutDashboard className="text-muted-foreground h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">More Reports Coming Soon</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              We are working on integrating more reporting and analytics tools into this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
