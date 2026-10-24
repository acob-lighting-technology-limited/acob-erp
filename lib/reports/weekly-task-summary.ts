import { isTaskInCycle, type CycleAnchoredTask } from "@/lib/tasks/scoring"
import { normalizeDepartmentName } from "@/shared/departments"

/**
 * Per-department task counts shown on the weekly report PowerPoint.
 *
 * A report for week N is presented at week N's Monday meeting, so the work it
 * describes is the seven days before that Monday. "Assigned" is every task
 * owed in that window (its deadline falls in it, by the same anchor the PMS
 * cycle uses) plus anything finished in it; "completed" is the subset
 * approved as completed inside the window. A task owed this week but still
 * open shows as assigned-not-completed, which is the point of the 0 / 3 rows.
 */

export type WeeklyTaskSummaryPerson = {
  id: string
  name: string
  completed: number
  assigned: number
}

export type WeeklyDeptTaskSummary = {
  department: string
  completed: number
  assigned: number
  people: WeeklyTaskSummaryPerson[]
}

/** What the full-layout PowerPoint export needs to draw the task counts column. */
export type WeeklyTaskSummaryOptions = {
  /** Keyed by canonical department name. */
  summaries: Map<string, WeeklyDeptTaskSummary>
}

export type WeeklyTaskWindow = {
  /** First day of the window, YYYY-MM-DD (Lagos calendar date). */
  startDate: string
  /** Last day of the window, inclusive. */
  endDate: string
  /** Window bounds as instants, for completed_at. End is exclusive. */
  startAt: string
  endAt: string
}

export type SummaryTaskRow = CycleAnchoredTask & {
  assigned_to: string | null
  status: string | null
  completed_at: string | null
}

export type SummaryPersonRow = {
  id: string
  first_name: string | null
  last_name: string | null
  department: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
// Lagos is UTC+1 all year, so midnight WAT is 23:00 UTC the day before.
const LAGOS_OFFSET_MS = 60 * 60 * 1000

// `ms` is a UTC midnight standing in for a calendar date, so read it back in UTC.
const isoDay = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** The seven days before week N's Monday meeting. */
export function getWeeklyTaskWindow(week: number, year: number, anchorDay: number): WeeklyTaskWindow {
  const meetingMonday = Date.UTC(year, 0, anchorDay) + (week - 1) * 7 * DAY_MS
  const start = meetingMonday - 7 * DAY_MS
  return {
    startDate: isoDay(start),
    endDate: isoDay(meetingMonday - DAY_MS),
    startAt: new Date(start - LAGOS_OFFSET_MS).toISOString(),
    endAt: new Date(meetingMonday - LAGOS_OFFSET_MS).toISOString(),
  }
}

const personName = (p: SummaryPersonRow) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed"

export function summarizeWeeklyTasks(
  tasks: SummaryTaskRow[],
  people: SummaryPersonRow[],
  window: WeeklyTaskWindow
): WeeklyDeptTaskSummary[] {
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const startMs = Date.parse(window.startAt)
  const endMs = Date.parse(window.endAt)
  const counts = new Map<string, { completed: number; assigned: number }>()

  for (const task of tasks) {
    if (!task.assigned_to) continue
    const doneAt = task.completed_at ? Date.parse(task.completed_at) : null
    const isCompleted = task.status === "completed"
    const doneInWindow = isCompleted && doneAt !== null && doneAt >= startMs && doneAt < endMs
    const owedInWindow = isTaskInCycle(task, window.startDate, window.endDate)
    // Finished before the window opened: it belonged to an earlier report.
    if (isCompleted && doneAt !== null && doneAt < startMs) continue
    if (!doneInWindow && !owedInWindow) continue

    const entry = counts.get(task.assigned_to) ?? { completed: 0, assigned: 0 }
    entry.assigned += 1
    if (doneInWindow || (isCompleted && doneAt === null)) entry.completed += 1
    counts.set(task.assigned_to, entry)
  }

  const byDept = new Map<string, WeeklyDeptTaskSummary>()
  counts.forEach((entry, userId) => {
    const person = peopleById.get(userId)
    if (!person?.department) return
    const department = normalizeDepartmentName(person.department)
    const dept = byDept.get(department) ?? { department, completed: 0, assigned: 0, people: [] }
    dept.completed += entry.completed
    dept.assigned += entry.assigned
    dept.people.push({ id: userId, name: personName(person), ...entry })
    byDept.set(department, dept)
  })

  return Array.from(byDept.values()).map((dept) => ({
    ...dept,
    people: dept.people.sort(
      (a, b) => b.completed - a.completed || b.assigned - a.assigned || a.name.localeCompare(b.name)
    ),
  }))
}

/** Client-side: task counts for one report week, ready to pass to the PowerPoint export. */
export async function loadWeeklyTaskSummaryOptions(week: number, year: number): Promise<WeeklyTaskSummaryOptions> {
  const res = await fetch(`/api/reports/weekly-reports/task-summary?week=${week}&year=${year}`)
  if (!res.ok) throw new Error("Could not load task counts for this week")
  const { data } = (await res.json()) as { data: WeeklyDeptTaskSummary[] }
  return { summaries: new Map(data.map((d) => [d.department, d])) }
}
