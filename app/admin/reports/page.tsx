"use client"

import { ShieldCheck, Users } from "lucide-react"
import { PageWrapper, PageHeader, ModuleHubGrid } from "@/components/layout"
import { PageSection } from "@/components/ui/patterns"

export default function AdminReportsPage() {
  const reportCards = [
    {
      title: "General Meeting",
      description: "Open the weekly reports, action tracker, KSS, and minutes tools that support your general meeting.",
      href: "/admin/reports/general-meeting",
      icon: Users,
      color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-indigo-500/60 dark:hover:border-indigo-400/60",
      hoverText: "group-hover:text-indigo-500",
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
        <ModuleHubGrid
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          cards={reportCards.map((c) => ({
            title: c.title,
            description: c.description,
            href: c.href,
            icon: c.icon,
            footer: "Meeting Hub",
            color: c.color,
            fill: c.fill,
            hoverBorder: c.hoverBorder,
            hoverText: c.hoverText,
          }))}
        />
      </PageSection>
    </PageWrapper>
  )
}
