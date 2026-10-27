"use client"

import { FileBarChart, Users } from "lucide-react"
import { PageWrapper, PageHeader, ModuleHubGrid } from "@/components/layout"

export default function PortalReportsPage() {
  const reportCards = [
    {
      title: "General Meeting",
      description: "Open the weekly reports, action tracker, KSS, and minutes tools used for your general meeting.",
      href: "/reports/general-meeting",
      icon: Users,
      tag: "Hub",
      subLabel: "4 meeting tools",
      color: "bg-indigo-500/10 text-info border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-info/50",
      hoverText: "group-hover:text-indigo-500",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Reports"
        description="Access project status reports, action tracking tools, and weekly performance summaries."
        icon={FileBarChart}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />

      <ModuleHubGrid
        cards={reportCards.map((c) => ({
          title: c.title,
          description: c.description,
          href: c.href,
          icon: c.icon,
          tag: c.tag,
          footer: c.subLabel,
          color: c.color,
          fill: c.fill,
          hoverBorder: c.hoverBorder,
          hoverText: c.hoverText,
        }))}
      />
    </PageWrapper>
  )
}
