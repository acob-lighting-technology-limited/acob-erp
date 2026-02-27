"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, ClipboardList, FileText, ChevronRight } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader } from "@/components/layout"

export default function AdminReportsPage() {
  const reportCards = [
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
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Reports"
        description="Manage report content and meeting distribution workflows from one place."
        icon={ShieldCheck}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      <section className="space-y-4">
        <h2 className="text-foreground text-lg font-semibold">Reports</h2>
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
                    Open <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </PageWrapper>
  )
}
