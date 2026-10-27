"use client"

import { PageWrapper, PageHeader, ModuleHubGrid } from "@/components/layout"
import { BookOpen, Mail, Megaphone, CalendarDays } from "lucide-react"

export default function CommunicationsMeetingsPage() {
  const cards = [
    {
      title: "Reports",
      description: "Send meeting packs with weekly reports and Action Points one-time or recurring.",
      href: "/admin/communications/meetings/mail",
      icon: Mail,
      color: "bg-indigo-500/10 text-info border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-info/50",
      hoverText: "group-hover:text-indigo-500",
    },
    {
      title: "Reminders",
      description: "Send the general meeting reminder with scheduling controls.",
      href: "/admin/communications/meetings/reminders",
      icon: Megaphone,
      color: "bg-warning/10 text-warning border-warning/20",
      fill: "bg-orange-500",
      hoverBorder: "hover:border-warning/50",
      hoverText: "group-hover:text-orange-500",
    },
    {
      title: "Knowledge Sharing",
      description: "Presenting department rotation and the heads-up email to the next department.",
      href: "/admin/communications/meetings/kss",
      icon: BookOpen,
      color: "bg-success/10 text-success border-success/20",
      fill: "bg-green-500",
      hoverBorder: "hover:border-success/50",
      hoverText: "group-hover:text-green-500",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Communications: General Meeting"
        description="General meeting communication workflows (reports, reminders and knowledge sharing)."
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
