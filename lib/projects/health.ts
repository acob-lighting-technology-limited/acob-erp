/**
 * Project progress — derived, never stored.
 *
 * A project keeps no progress column. Its figures are recomputed from its
 * tasks each time it is read, so a project and the employees who work it can
 * never drift apart: there is one task row, read two ways.
 *
 * These figures are read by everyone, not just managers, so they are counted
 * the way a person would check them by hand: tasks done out of tasks planned,
 * and days used out of days scheduled. Task weights stay in PMS scoring
 * (lib/tasks/scoring.ts), where fairness between employees matters more than
 * being able to count along.
 */

export type ProjectHealthStatus = "on_track" | "at_risk" | "behind_schedule" | "completed"

export const PROJECT_HEALTH_LABELS: Record<ProjectHealthStatus, string> = {
  on_track: "On time",
  at_risk: "Slipping",
  behind_schedule: "Behind",
  completed: "Done",
}

/**
 * Plain-language help for the figures above, shown on every page that displays
 * them so the wording cannot drift between pages.
 */
export const PROJECT_METRIC_HELP = {
  workDone: "Tasks marked completed, out of all the tasks on the project. Cancelled and reassigned tasks are left out.",
  timeUsed: "How much of the project's schedule has passed, from its start date to its end date.",
  progress:
    "Done: every task is completed. Behind: work done is more than 15% behind time used. Slipping: more than 5% behind, or a task is past its due date. Otherwise On time.",
  pastDue: "Tasks whose due date has passed and that are not completed.",
  rating: "The average star rating given to completed tasks.",
  stage: "Set by the project manager: Planning, Ongoing, On hold, Completed or Cancelled.",
  portfolioStatus: "Set by hand: Active, On hold or Closed.",
  portfolioProjects: "How many projects are in this portfolio, and how they are progressing.",
} as const

/** How far work may trail the calendar, in percentage points, before a project is flagged. */
const SLIPPING_GAP = 5
const BEHIND_GAP = 15

const LEFT_OUT_STATUSES = new Set(["cancelled", "reassigned"])

export type ProjectHealthTask = {
  status?: string | null
  rating?: number | null
  is_archived?: boolean | null
  due_date?: string | null
  task_end_date?: string | null
  plan_id?: string | null
}

export type ProjectHealth = {
  /** Tasks on the project, not counting archived, cancelled or reassigned ones. */
  taskCount: number
  doneCount: number
  /** doneCount out of taskCount, as a whole percentage; null with no tasks. */
  workDonePct: number | null
  /** Days in the schedule, start to end; null without a usable schedule. */
  daysTotal: number | null
  /** Days since the start date, kept between 0 and daysTotal. */
  daysUsed: number | null
  timeUsedPct: number | null
  /** Days past the end date, 0 while the schedule is still running. */
  daysOverrun: number
  /** Days until the start date, 0 once the project has started. */
  daysToStart: number
  overdueCount: number
  averageRating: number | null
  ratedCount: number
  /** Plans on the project, and how many have every one of their tasks done. */
  planCount: number
  plansDoneCount: number
  status: ProjectHealthStatus
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00`)
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

function isCounted(task: ProjectHealthTask) {
  if (task.is_archived) return false
  return !LEFT_OUT_STATUSES.has(String(task.status || "").toLowerCase())
}

function isDone(task: ProjectHealthTask) {
  return String(task.status || "").toLowerCase() === "completed"
}

function isOverdue(task: ProjectHealthTask, today: string): boolean {
  if (!isCounted(task) || isDone(task)) return false
  const deadline = task.task_end_date || task.due_date
  if (!deadline) return false
  return String(deadline).slice(0, 10) < today
}

/** Tasks done out of tasks planned — also used for a single plan. */
export function countWork(tasks: ProjectHealthTask[]) {
  const counted = tasks.filter(isCounted)
  const doneCount = counted.filter(isDone).length
  return {
    taskCount: counted.length,
    doneCount,
    workDonePct: counted.length > 0 ? Math.round((doneCount / counted.length) * 100) : null,
  }
}

export function computeProjectHealth(params: {
  startDate: string | null | undefined
  endDate: string | null | undefined
  tasks: ProjectHealthTask[]
  /** The project's plan ids. A plan counts as finished once it has tasks and all are done. */
  planIds?: string[]
  today: string
}): ProjectHealth {
  const { startDate, endDate, tasks, planIds = [], today } = params
  const work = countWork(tasks)
  const overdueCount = tasks.filter((task) => isOverdue(task, today)).length

  const ratings = tasks
    .filter((task) => isCounted(task) && isDone(task))
    .map((task) => Number(task.rating))
    .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5)
  const averageRating =
    ratings.length > 0 ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10 : null

  let daysTotal: number | null = null
  let daysUsed: number | null = null
  let timeUsedPct: number | null = null
  let daysOverrun = 0
  let daysToStart = 0
  if (startDate && endDate && daysBetween(startDate, endDate) > 0) {
    daysTotal = daysBetween(startDate, endDate)
    const sinceStart = daysBetween(startDate, today)
    daysUsed = Math.min(daysTotal, Math.max(0, sinceStart))
    timeUsedPct = Math.round((daysUsed / daysTotal) * 100)
    daysOverrun = Math.max(0, sinceStart - daysTotal)
    daysToStart = Math.max(0, -sinceStart)
  }

  let status: ProjectHealthStatus
  if (work.taskCount > 0 && work.doneCount === work.taskCount) {
    status = "completed"
  } else if (work.workDonePct === null || timeUsedPct === null) {
    // Nothing to compare against the calendar: a late task is the only signal,
    // and saying nothing is better than inventing a problem.
    status = overdueCount > 0 ? "at_risk" : "on_track"
  } else {
    const gap = timeUsedPct - work.workDonePct
    if (gap > BEHIND_GAP) status = "behind_schedule"
    else if (gap > SLIPPING_GAP || overdueCount > 0) status = "at_risk"
    else status = "on_track"
  }

  return {
    ...work,
    daysTotal,
    daysUsed,
    timeUsedPct,
    daysOverrun,
    daysToStart,
    overdueCount,
    averageRating,
    ratedCount: ratings.length,
    planCount: planIds.length,
    plansDoneCount: planIds.filter((planId) => {
      const planWork = countWork(tasks.filter((task) => task.plan_id === planId))
      return planWork.taskCount > 0 && planWork.doneCount === planWork.taskCount
    }).length,
    status,
  }
}

/** "3 of 10 weeks", or days for a schedule shorter than eight weeks. */
export function formatTimeUsed(health: Pick<ProjectHealth, "daysUsed" | "daysTotal">): string | null {
  if (health.daysUsed === null || health.daysTotal === null) return null
  if (health.daysTotal < 56) return `${health.daysUsed} of ${health.daysTotal} days`
  return `${Math.round(health.daysUsed / 7)} of ${Math.round(health.daysTotal / 7)} weeks`
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

/**
 * Why a project needs attention, in one plain sentence — or null when it does
 * not. The same wording is used on the pages and in the manager's notification.
 */
export function describeAttention(health: ProjectHealth): string | null {
  if (health.status !== "at_risk" && health.status !== "behind_schedule") return null
  const reasons: string[] = []
  if (
    health.timeUsedPct !== null &&
    health.workDonePct !== null &&
    health.timeUsedPct - health.workDonePct > SLIPPING_GAP
  ) {
    reasons.push(`${health.workDonePct}% of work done with ${health.timeUsedPct}% of time used`)
  }
  if (health.overdueCount > 0) reasons.push(`${plural(health.overdueCount, "task")} past due`)
  return reasons.join(" · ") || null
}

/** Rolls several projects into one portfolio-level view. */
export function computePortfolioHealth(projects: ProjectHealth[]) {
  const taskCount = projects.reduce((sum, p) => sum + p.taskCount, 0)
  const doneCount = projects.reduce((sum, p) => sum + p.doneCount, 0)

  return {
    projectCount: projects.length,
    onTrack: projects.filter((p) => p.status === "on_track").length,
    atRisk: projects.filter((p) => p.status === "at_risk").length,
    behindSchedule: projects.filter((p) => p.status === "behind_schedule").length,
    completed: projects.filter((p) => p.status === "completed").length,
    overdueCount: projects.reduce((sum, p) => sum + p.overdueCount, 0),
    // Counted across every task, not averaged per project, so a big project
    // cannot be hidden behind a few small finished ones.
    taskCount,
    doneCount,
    workDonePct: taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : null,
    planCount: projects.reduce((sum, p) => sum + p.planCount, 0),
    plansDoneCount: projects.reduce((sum, p) => sum + p.plansDoneCount, 0),
  }
}

export type PortfolioHealth = ReturnType<typeof computePortfolioHealth>
