"use client"

import { Briefcase, CalendarDays, Presentation, Users } from "lucide-react"
import { EventsWorkspace } from "@/components/events/events-workspace"
import { MD_DESK_ENGAGEMENTS, type MdDeskEngagementSection } from "./sections"

const ICONS = {
  calendar: CalendarDays,
  meetings: Users,
  workshops: Presentation,
  activities: Briefcase,
} as const

/**
 * MD's Desk → Calendar / Meetings / Workshops & Webinars / Activities. Each is the
 * company events calendar filtered to the MD's schedule (scope "md") and, except
 * Calendar, to its event types. New events default to that type with the MD attending.
 */
export function MdDeskEngagements({ section, basePath }: { section: MdDeskEngagementSection; basePath: string }) {
  const config = MD_DESK_ENGAGEMENTS[section]
  return (
    <EventsWorkspace
      title={config.title}
      description={config.description}
      icon={ICONS[section]}
      backLink={{ href: basePath, label: "Back to MD's Desk" }}
      scope="md"
      variant="manage"
      tabs={section === "calendar" ? ["calendar", "upcoming", "past"] : ["upcoming", "calendar", "past"]}
      eventTypes={config.eventTypes}
      formDefaults={{ md_involvement: "attending", ...(config.defaultType ? { type: config.defaultType } : {}) }}
    />
  )
}
