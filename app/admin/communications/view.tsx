"use client"

import { PageWrapper, PageHeader, ModuleHubGrid } from "@/components/layout"
import { Mail, Megaphone } from "lucide-react"

export function CommunicationsPage({
  basePath,
  /**
   * Meeting tools are admin-only (policy route "communications.meetings") and
   * have no /dept/[id]/ equivalent, so the dept console hides the card rather
   * than linking leads to a route that 404s.
   */
  showMeetings = true,
}: { basePath?: string; showMeetings?: boolean } = {}) {
  const base = basePath ?? "/admin"
  const cards = [
    {
      title: "Broadcast",
      description: "Send department-branded broadcast emails with rich text content.",
      href: `${base}/communications/broadcast`,
      icon: Megaphone,
      color: "bg-warning/10 text-warning border-warning/20",
      fill: "bg-orange-500",
      hoverBorder: "hover:border-warning/50",
      hoverText: "group-hover:text-orange-500",
    },
    ...(showMeetings
      ? [
          {
            title: "General Meeting",
            description: "Open general meeting communication tools (reports and reminders).",
            href: `${base}/communications/meetings`,
            icon: Mail,
            color: "bg-indigo-500/10 text-info border-indigo-500/20",
            fill: "bg-indigo-500",
            hoverBorder: "hover:border-info/50",
            hoverText: "group-hover:text-indigo-500",
          },
        ]
      : []),
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Communications"
        description="Manage outbound email communication workflows from one place."
        icon={Megaphone}
        backLink={{ href: base, label: "Back" }}
      />

      <ModuleHubGrid
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        cards={cards.map((c) => ({
          title: c.title,
          description: c.description,
          href: c.href,
          icon: c.icon,
          footer: "Outbound Tools",
          color: c.color,
          fill: c.fill,
          hoverBorder: c.hoverBorder,
          hoverText: c.hoverText,
        }))}
      />
    </PageWrapper>
  )
}
