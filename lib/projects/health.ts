/**
 * Project health — derived, never stored.
 *
 * A project keeps no progress column. Its figures are recomputed from its
 * tasks each time it is read, so a project and the employees who work it can
 * never drift apart: there is one task row, read two ways.
 *
 * Delivery and quality are kept apart on purpose. A task can be finished on
 * time and still be poor work, and a single blended number would hide exactly
 * the case worth seeing — full delivery on badly rated work.
 */

import { computeProjectProgress, type ScorableTask } from "@/lib/tasks/scoring"

export type ProjectHealthStatus = "on_track" | "at_risk" | "behind_schedule" | "completed"

export const PROJECT_HEALTH_LABELS: Record<ProjectHealthStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind_schedule: "Behind Schedule",
  completed: "Completed",
}

/**
 * One-line definitions for the figures above, shown as header help on every
 * table that displays them so the wording cannot drift between pages.
 */
export const PROJECT_METRIC_HELP = {
  elapsed:
    "How far through its schedule the project is today: days since the start date over the total days to the end date.",
  delivery:
    "Share of the planned work that is finished, by task weight (1–5). Cancelled and reassigned tasks are left out.",
  quality:
    "How well the work scored: each task's weight × rating ÷ 5, over all its scorable tasks. Unfinished work counts as 0; completed work awaiting a rating is held out.",
  deliveryQuality:
    "Delivered: share of planned work finished, by task weight. Quality: weighted task ratings, with unfinished work counting as 0.",
  variance:
    "Delivered minus Elapsed. Negative means the calendar has moved further than the work; below −5% is At Risk, below −15% is Behind Schedule.",
  overdue: "Tasks past their end or due date that are not completed, cancelled or reassigned.",
  health:
    "Worked out from the tasks: Completed at 100% delivered; Behind Schedule when variance is below −15%; At Risk below −5% or with any overdue task; otherwise On Track.",
  status:
    "The stage a manager sets by hand (planning, ongoing, on hold, completed, cancelled). Separate from the calculated health.",
  portfolioStatus: "Set by hand: active, on hold, or closed.",
  portfolioProjects: "Projects in this portfolio, counted by their calculated health.",
  portfolioDeliveryQuality:
    "Delivered: finished task weight over total task weight across all its projects. Quality: the average of its projects' quality.",
} as const

/** Delivery may sit this far behind elapsed time before the project is flagged. */
const AT_RISK_VARIANCE = -5
const BEHIND_VARIANCE = -15

export type ProjectHealthTask = ScorableTask & {
  status?: string | null
  due_date?: string | null
  task_end_date?: string | null
}

export type ProjectHealth = {
  deliveryPct: number | null
  qualityPct: number | null
  timeElapsedPct: number | null
  /** Delivery minus elapsed time: negative means behind the calendar. */
  variancePct: number | null
  status: ProjectHealthStatus
  overdueCount: number
  totalWeight: number
  completedWeight: number
  taskCount: number
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00`)
  const end = Date.parse(`${to}T00:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

/** How far through its own schedule the project is today, capped at 100%. */
export function computeTimeElapsedPct(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: string
): number | null {
  if (!startDate || !endDate) return null
  const totalDays = daysBetween(startDate, endDate)
  if (totalDays <= 0) return null
  const elapsedDays = daysBetween(startDate, today)
  if (elapsedDays <= 0) return 0
  return Math.min(100, Math.round((elapsedDays / totalDays) * 100 * 100) / 100)
}

function isOverdue(task: ProjectHealthTask, today: string): boolean {
  const status = String(task.status || "").toLowerCase()
  if (status === "completed" || status === "cancelled" || status === "reassigned") return false
  const deadline = task.task_end_date || task.due_date
  if (!deadline) return false
  return String(deadline).slice(0, 10) < today
}

/**
 * Compares weighted delivery against elapsed schedule time.
 *
 * This is a rough measure by design: a true planned-progress curve would need
 * a baseline date on every plan, which is setup work the project managers
 * would have to do before the dashboard showed anything at all. Elapsed time
 * is available from day one and is honest about what it is.
 */
export function computeProjectHealth(params: {
  startDate: string | null | undefined
  endDate: string | null | undefined
  tasks: ProjectHealthTask[]
  today: string
}): ProjectHealth {
  const { startDate, endDate, tasks, today } = params

  const progress = computeProjectProgress(tasks)
  const timeElapsedPct = computeTimeElapsedPct(startDate, endDate, today)
  const overdueCount = tasks.filter((task) => isOverdue(task, today)).length

  const taskCount = tasks.filter((task) => !task.is_archived).length
  const variancePct =
    progress.deliveryPct !== null && timeElapsedPct !== null
      ? Math.round((progress.deliveryPct - timeElapsedPct) * 100) / 100
      : null

  let status: ProjectHealthStatus
  if (taskCount > 0 && progress.deliveryPct === 100) {
    status = "completed"
  } else if (variancePct === null) {
    // No schedule or no weighted work to measure: overdue work is the only
    // signal available, and silence is better than a fabricated "On Track".
    status = overdueCount > 0 ? "at_risk" : "on_track"
  } else if (variancePct < BEHIND_VARIANCE) {
    status = "behind_schedule"
  } else if (variancePct < AT_RISK_VARIANCE || overdueCount > 0) {
    status = "at_risk"
  } else {
    status = "on_track"
  }

  return {
    deliveryPct: progress.deliveryPct,
    qualityPct: progress.qualityPct,
    timeElapsedPct,
    variancePct,
    status,
    overdueCount,
    totalWeight: progress.totalWeight,
    completedWeight: progress.completedWeight,
    taskCount,
  }
}

/** Rolls several projects' health into one portfolio-level view. */
export function computePortfolioHealth(projects: ProjectHealth[]) {
  const totalWeight = projects.reduce((sum, project) => sum + project.totalWeight, 0)
  const completedWeight = projects.reduce((sum, project) => sum + project.completedWeight, 0)

  // Weighted by task weight rather than a mean of percentages, so a large
  // project cannot be masked by several small ones sitting at 100%.
  const deliveryPct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100 * 100) / 100 : null

  const qualityValues = projects.map((p) => p.qualityPct).filter((v): v is number => typeof v === "number")
  const qualityPct =
    qualityValues.length > 0
      ? Math.round((qualityValues.reduce((sum, v) => sum + v, 0) / qualityValues.length) * 100) / 100
      : null

  return {
    projectCount: projects.length,
    onTrack: projects.filter((p) => p.status === "on_track").length,
    atRisk: projects.filter((p) => p.status === "at_risk").length,
    behindSchedule: projects.filter((p) => p.status === "behind_schedule").length,
    completed: projects.filter((p) => p.status === "completed").length,
    overdueCount: projects.reduce((sum, p) => sum + p.overdueCount, 0),
    deliveryPct,
    qualityPct,
    totalWeight,
    completedWeight,
  }
}
