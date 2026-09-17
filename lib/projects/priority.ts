/**
 * Project priority — set by hand, stored on projects.priority.
 *
 * Kept apart from the calculated progress status on purpose: priority says how
 * much a project matters, status says how it is going. A low-priority project
 * can be Behind, and a critical one can be On time.
 */

export const PROJECT_PRIORITIES = ["critical", "high", "medium", "low"] as const
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export const DEFAULT_PROJECT_PRIORITY: ProjectPriority = "medium"

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export const PROJECT_PRIORITY_HELP =
  "How much this project matters, set by the project manager: Critical, High, Medium or Low. Separate from how the project is progressing."

/** Anything unexpected reads as the default rather than breaking a sort. */
export function normalizePriority(value: string | null | undefined): ProjectPriority {
  return PROJECT_PRIORITIES.includes(value as ProjectPriority) ? (value as ProjectPriority) : DEFAULT_PROJECT_PRIORITY
}

/** 0 for Critical up to 3 for Low — sort ascending to put the most important first. */
export function priorityRank(value: string | null | undefined) {
  return PROJECT_PRIORITIES.indexOf(normalizePriority(value))
}
