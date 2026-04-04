"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileBarChart, ChevronRight, ArrowLeft, Users } from "lucide-react"
import Link from "next/link"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"

export default function PortalReportsPage() {
  const reportCards = [
    {
      title: "General Meeting",
      description: "Open the weekly reports, action tracker, KSS, and minutes tools used for your general meeting.",
      href: "/reports/general-meeting",
      icon: Users,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground gap-2">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Reports"
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
      </div>
    </PageWrapper>
  )
}
