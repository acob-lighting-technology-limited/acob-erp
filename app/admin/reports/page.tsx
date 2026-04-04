"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Send, Users, ChevronRight } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader } from "@/components/layout"
import { PageSection } from "@/components/ui/patterns"

export default function AdminReportsPage() {
  const reportCards = [
    {
      title: "General Meeting",
      description: "Open the weekly reports, action tracker, KSS, and minutes tools that support your general meeting.",
      href: "/admin/reports/general-meeting",
      icon: Users,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    },
    {
      title: "Meeting Mail",
      description: "Prepare and send the weekly meeting summary mail with the stored report documents.",
      href: "/admin/communications/meetings/mail",
      icon: Send,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
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

      <PageSection title="Reports" className="space-y-4">
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
      </PageSection>
    </PageWrapper>
  )
}
