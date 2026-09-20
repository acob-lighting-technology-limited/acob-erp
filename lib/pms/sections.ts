import type { NavChild } from "@/lib/nav/types"

/**
 * PMS sub-pages, in nav order. Shared by the three sidebars and the /pms
 * sub-nav so a viewer sees the same order in both places on the same screen.
 *
 * `adminOnly` marks the pages that exist only on the admin and dept shells —
 * staff have no cycle or competency management of their own.
 */
export const PMS_SECTIONS = [
  { slug: "analytics", name: "Analytics", adminOnly: true },
  { slug: "cycles", name: "Cycles", adminOnly: true },
  { slug: "goals", name: "Goals" },
  { slug: "kpi", name: "KPI", description: "Key Performance Indicators" },
  { slug: "reviews", name: "Reviews" },
  { slug: "peer-feedback", name: "Peer Feedback" },
  { slug: "development-plans", name: "Development Plans" },
  { slug: "behaviour", name: "Behaviour" },
  { slug: "competencies", name: "Competencies", adminOnly: true },
  { slug: "cbt", name: "CBT", description: "Computer Based Test" },
  { slug: "attendance", name: "Attendance" },
] as const

export type PmsSectionSlug = (typeof PMS_SECTIONS)[number]["slug"]

/** Nav children for a PMS base path. Staff surfaces pass `staffOnly` to drop the admin pages. */
export function pmsNavChildren(basePath: string, options?: { staffOnly?: boolean }) {
  return PMS_SECTIONS.filter((section) => !(options?.staffOnly && "adminOnly" in section && section.adminOnly)).map(
    (section): NavChild => ({
      name: section.name,
      href: `${basePath}/${section.slug}`,
      ...("description" in section ? { description: section.description } : {}),
    })
  )
}
