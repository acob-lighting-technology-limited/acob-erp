import type { EventType } from "@/lib/events/types"

/**
 * MD's Desk sub-pages, in sidebar order. Shared by the admin and staff sidebars
 * and the route pages so both shells stay identical.
 *
 * Webinars are not their own section: a webinar is a workshop or training
 * delivered online, so it lives under "Workshops & Webinars" with an In person /
 * Virtual filter rather than splitting the same engagement across two pages.
 */
export const MD_DESK_SECTIONS = [
  { slug: "overview", name: "Overview" },
  { slug: "calendar", name: "Calendar" },
  { slug: "meetings", name: "Meetings" },
  { slug: "workshops", name: "Workshops & Webinars" },
  { slug: "activities", name: "Activities" },
  { slug: "reports", name: "Reports" },
  { slug: "delegates", name: "Delegates" },
] as const

export function mdDeskNavChildren(basePath: string): { name: string; href: string }[] {
  return MD_DESK_SECTIONS.map((s) => ({ name: s.name, href: `${basePath}/${s.slug}` }))
}

export type MdDeskEngagementSection = "calendar" | "meetings" | "workshops" | "activities"

export const MD_DESK_ENGAGEMENTS: Record<
  MdDeskEngagementSection,
  { title: string; description: string; eventTypes?: readonly EventType[]; defaultType?: EventType }
> = {
  calendar: {
    title: "MD's Calendar",
    description: "Every engagement on the MD's schedule, including private ones.",
  },
  meetings: {
    title: "Meetings",
    description: "Meetings the MD hosts or attends — board, management, client and one-to-one.",
    eventTypes: ["meeting"],
    defaultType: "meeting",
  },
  workshops: {
    title: "Workshops & Webinars",
    description: "Workshops, trainings and webinars the MD hosts or attends, in person or online.",
    eventTypes: ["workshop", "webinar", "training"],
    defaultType: "workshop",
  },
  activities: {
    title: "Activities",
    description: "Site visits, company activities and external engagements on the MD's schedule.",
    eventTypes: ["activity"],
    defaultType: "activity",
  },
}
