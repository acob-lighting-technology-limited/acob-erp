"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, FileBarChart, ClipboardList, FileText, Mail, ChevronRight, Megaphone } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"

export default function AdminReportsPage() {
  const adminReportCards = [
    {
      title: "Action Tracker Management",
      description: "Oversee project progress, track pending actions across all departments, and manage status updates.",
      href: "/admin/reports/action-tracker",
      icon: ClipboardList,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Weekly Reports Administration",
      description: "Review, manage, and export weekly status updates and performance summaries from all employees.",
      href: "/admin/reports/weekly-reports",
      icon: FileText,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "General Meeting Mailing",
      description:
        "Send weekly report digests and action trackers via email. Choose recipients, schedule or set up recurring delivery.",
      href: "/admin/reports/mail",
      icon: Mail,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Meeting Reminders",
      description:
        "Send general meeting and knowledge sharing session reminders with custom dates, times, agenda, and Teams links.",
      href: "/admin/reports/meeting-reminders",
      icon: Megaphone,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Reports Administration"
        description="Centralized management for project tracking tools and company-wide reporting metrics."
        icon={ShieldCheck}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {adminReportCards.map((card) => (
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
                  Manage Submissions <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Placeholder for future admin reports */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex h-full flex-col items-center justify-center py-12 text-center">
            <div className="bg-background mb-4 flex h-12 w-12 items-center justify-center rounded-full border shadow-sm">
              <FileBarChart className="text-muted-foreground h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Future Analytical Tools</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              Administrative analytical dashboards for department performance and resource allocation are under
              development.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
