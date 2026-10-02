"use client"

import { PageWrapper, PageHeader, ModuleHubGrid } from "@/components/layout"
import { Mail, Megaphone, CalendarDays } from "lucide-react"

export default function CommunicationsMeetingsPage() {
  const cards = [
    {
      title: "Reports",
      description: "Send meeting packs with weekly reports and Action Points one-time or recurring.",
      href: "/admin/communications/meetings/mail",
      icon: Mail,
      color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-indigo-500/60 dark:hover:border-indigo-400/60",
      hoverText: "group-hover:text-indigo-500",
    },
    {
      title: "Reminders",
      description: "Send meeting and knowledge-sharing reminders with scheduling controls.",
      href: "/admin/communications/meetings/reminders",
      icon: Megaphone,
      color: "bg-orange-500/10 text-warning-foreground border-orange-500/20",
      fill: "bg-orange-500",
      hoverBorder: "hover:border-orange-500/60 dark:hover:border-orange-400/60",
      hoverText: "group-hover:text-orange-500",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Communications: General Meeting"
        description="General meeting communication workflows (reports and reminders)."
        icon={CalendarDays}
        backLink={{ href: "/admin/communications", label: "Back to Communications" }}
      />

      <ModuleHubGrid
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        cards={cards.map((c) => ({
          title: c.title,
          description: c.description,
          href: c.href,
          icon: c.icon,
          footer: "Meeting Workflow",
          color: c.color,
          fill: c.fill,
          hoverBorder: c.hoverBorder,
          hoverText: c.hoverText,
        }))}
      />
    </PageWrapper>
  )
}
