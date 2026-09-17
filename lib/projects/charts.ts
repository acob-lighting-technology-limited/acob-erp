/**
 * Figures behind the project and portfolio Charts tab — derived from tasks on
 * every read, like the rest of project progress, and counted the same way
 * (lib/projects/health.ts) so a chart never disagrees with the Overview.
 */

import { isCountedTask, isTaskDone, type ProjectHealthTask } from "@/lib/projects/health"
import { toLocalISODate } from "@/lib/utils/date"

export type ChartProject = {
  id: string
  project_name: string
  portfolioId: string | null
  startDate: string | null
  endDate: string | null
  tasks: ProjectHealthTask[]
}

const DAY_MS = 86_400_000

function toDay(value: string) {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
}

/** A day number back to YYYY-MM-DD. Days here are whole UTC midnights, never a moment in time. */
function isoDay(ms: number) {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** The calendar day a task was finished on, in Nigerian time rather than UTC. */
function completionDay(completedAt: string) {
  return toLocalISODate(new Date(completedAt))
}

/** The Monday of the week a date falls in. */
export function weekStart(value: string) {
  const ms = toDay(value)
  const weekday = (new Date(ms).getUTCDay() + 6) % 7
  return isoDay(ms - weekday * DAY_MS)
}

function hasSchedule(project: ChartProject) {
  return Boolean(project.startDate && project.endDate && toDay(project.endDate) > toDay(project.startDate))
}

export type ProgressPoint = {
  week: string
  /** Tasks finished by the end of this week; null for weeks still to come. */
  done: number | null
  /** Where the count would be if every project kept pace with its own schedule. */
  onPace: number | null
}

/** Longest history drawn, so one project dated years back cannot flatten the chart. */
const MAX_WEEKS = 104

/**
 * Tasks finished over time, against an on-pace line.
 *
 * Tasks finished without a recorded completion date (the July 2026 import) are
 * counted as already done at the start, so the line ends at the same total the
 * Overview shows. The on-pace line spreads each dated project's tasks evenly
 * from its start date to its end date — the same "time used" idea the project
 * status is judged on.
 */
export function buildProgressOverTime(projects: ChartProject[], today: string) {
  const counted = projects.map((project) => ({ project, tasks: project.tasks.filter(isCountedTask) }))
  const total = counted.reduce((sum, c) => sum + c.tasks.length, 0)
  const doneTasks = counted.flatMap((c) => c.tasks.filter(isTaskDone))
  const undatedDone = doneTasks.filter((task) => !task.completed_at).length
  const completionDays = doneTasks.flatMap((task) =>
    task.completed_at ? [toDay(completionDay(task.completed_at))] : []
  )

  const scheduled = counted.filter((c) => hasSchedule(c.project))
  const todayMs = toDay(today)
  const starts = [...scheduled.map((c) => toDay(c.project.startDate!)), ...completionDays]
  const ends = [todayMs, ...scheduled.map((c) => toDay(c.project.endDate!))]

  let first = toDay(weekStart(isoDay(starts.length > 0 ? Math.min(...starts) : todayMs)))
  const last = toDay(weekStart(isoDay(Math.max(...ends))))
  first = Math.max(first, last - (MAX_WEEKS - 1) * 7 * DAY_MS)

  const points: ProgressPoint[] = []
  for (let week = first; week <= last; week += 7 * DAY_MS) {
    const weekEnd = week + 6 * DAY_MS
    const done =
      week > todayMs ? null : undatedDone + completionDays.filter((day) => day <= Math.min(weekEnd, todayMs)).length
    const onPace =
      scheduled.length === 0
        ? null
        : Math.round(
            scheduled.reduce((sum, c) => {
              const start = toDay(c.project.startDate!)
              const end = toDay(c.project.endDate!)
              const share = Math.min(1, Math.max(0, (weekEnd - start) / (end - start)))
              return sum + c.tasks.length * share
            }, 0) * 10
          ) / 10
    points.push({ week: isoDay(week), done, onPace })
  }

  return {
    points,
    total,
    undatedDone,
    /** Projects left off the on-pace line because they have no start or end date. */
    unscheduledProjects: counted.length - scheduled.length,
  }
}

/** Tasks finished in each of the last `weeks` weeks, from recorded completion dates. */
export function buildWeeklyFinished(projects: ChartProject[], today: string, weeks = 12) {
  const doneTasks = projects.flatMap((project) => project.tasks.filter((t) => isCountedTask(t) && isTaskDone(t)))
  const thisWeek = toDay(weekStart(today))
  const counts = new Map<string, number>()
  for (const task of doneTasks) {
    if (!task.completed_at) continue
    const week = weekStart(completionDay(task.completed_at))
    counts.set(week, (counts.get(week) ?? 0) + 1)
  }
  return {
    points: Array.from({ length: weeks }, (_, index) => {
      const week = isoDay(thisWeek - (weeks - 1 - index) * 7 * DAY_MS)
      return { week, finished: counts.get(week) ?? 0 }
    }),
    undated: doneTasks.filter((task) => !task.completed_at).length,
  }
}

const IN_PROGRESS_STATUSES = new Set(["in_progress", "submitted_for_review"])

export type TaskBreakdownRow = {
  id: string
  project_name: string
  done: number
  inProgress: number
  notStarted: number
  pastDue: number
}

/**
 * Each project's tasks by where they stand today. Past due wins over in
 * progress, so a late task is never hidden inside the in-progress count.
 */
export function buildTaskBreakdown(projects: ChartProject[], today: string): TaskBreakdownRow[] {
  return projects
    .map((project) => {
      const row: TaskBreakdownRow = {
        id: project.id,
        project_name: project.project_name,
        done: 0,
        inProgress: 0,
        notStarted: 0,
        pastDue: 0,
      }
      for (const task of project.tasks.filter(isCountedTask)) {
        const deadline = task.task_end_date || task.due_date
        if (isTaskDone(task)) row.done++
        else if (deadline && deadline.slice(0, 10) < today) row.pastDue++
        else if (IN_PROGRESS_STATUSES.has(String(task.status || "").toLowerCase())) row.inProgress++
        else row.notStarted++
      }
      return row
    })
    .filter((row) => row.done + row.inProgress + row.notStarted + row.pastDue > 0)
    .sort(
      (a, b) =>
        b.pastDue - a.pastDue ||
        b.notStarted + b.inProgress - (a.notStarted + a.inProgress) ||
        a.project_name.localeCompare(b.project_name)
    )
}
