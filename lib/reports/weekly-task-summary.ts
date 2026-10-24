import { isTaskInCycle, taskCycleAnchor, type CycleAnchoredTask } from "@/lib/tasks/scoring"
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
 * Everyone passed in `people` gets a row, so staff given nothing that week
 * show as 0 / 0 rather than disappearing.
 *
 * Action points follow the same window. Week N-1's items are the "tasks for
 * the new week" set at the last meeting (plus any carried into it), so week
 * N's meeting is where they are checked.
 *
 * Looking ahead, for the Tasks for the New Week slide: "due this week" is open
 * work whose deadline falls in the seven days from the meeting Monday, and
 * "overdue" is open work whose deadline has already passed by that Monday.
 * Only tasks with a real deadline count here — the PMS anchor falls back to
 * the creation date, which would make every old no-deadline task "overdue".
 * Pending challenges are ones still open or being mitigated from any earlier
 * week's report.
 */

export type WeeklyTaskSummaryPerson = {
  id: string
  name: string
  completed: number
  assigned: number
}

export type WeeklyActionPointCounts = {
  total: number
  completed: number
  inProgress: number
  /** pending and not_started: nothing done on it yet. */
  notStarted: number
}

export type WeeklyCountRow = { id: string; name: string; count: number }

export type WeeklyPendingChallenges = {
  total: number
  open: number
  mitigating: number
  /** The earliest report week a still-pending challenge came from. */
  oldest: { week: number; year: number } | null
}

export type WeeklyDeptTaskSummary = {
  department: string
  completed: number
  assigned: number
  people: WeeklyTaskSummaryPerson[]
  actionPoints: WeeklyActionPointCounts
  /** Everyone in the department, with how many open tasks fall due in the coming week. */
  dueThisWeek: { total: number; people: WeeklyCountRow[] }
  /** Only people with overdue work; oldestDays is the longest any of it has been overdue. */
  overdue: { total: number; oldestDays: number | null; people: WeeklyCountRow[] }
  pendingChallenges: WeeklyPendingChallenges
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

export type SummaryActionPointRow = {
  department: string | null
  status: string | null
}

export type SummaryChallengeRow = {
  department: string | null
  status: string | null
  week_number: number
  year: number
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

/** The office week before `week`, whose action points week `week`'s meeting reviews. */
export function getPreviousOfficeWeek(week: number, year: number): { week: number; year: number } {
  // Same rollover the action tracker's carry-forward uses.
  return week > 1 ? { week: week - 1, year } : { week: 52, year: year - 1 }
}

const emptyActionPoints = (): WeeklyActionPointCounts => ({ total: 0, completed: 0, inProgress: 0, notStarted: 0 })

export const emptyDeptSummary = (department: string): WeeklyDeptTaskSummary => ({
  department,
  completed: 0,
  assigned: 0,
  people: [],
  actionPoints: emptyActionPoints(),
  dueThisWeek: { total: 0, people: [] },
  overdue: { total: 0, oldestDays: null, people: [] },
  pendingChallenges: { total: 0, open: 0, mitigating: 0, oldest: null },
})

const byCountThenName = (a: WeeklyCountRow, b: WeeklyCountRow) => b.count - a.count || a.name.localeCompare(b.name)

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
  peopleById.forEach((person, userId) => {
    if (!person.department) return
    const entry = counts.get(userId) ?? { completed: 0, assigned: 0 }
    const department = normalizeDepartmentName(person.department)
    const dept = byDept.get(department) ?? emptyDeptSummary(department)
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

/** Adds action-point counts, creating entries for departments with action points but no tasks. */
export function attachActionPoints(
  summaries: WeeklyDeptTaskSummary[],
  rows: SummaryActionPointRow[]
): WeeklyDeptTaskSummary[] {
  const byDept = new Map(summaries.map((s) => [s.department, { ...s, actionPoints: emptyActionPoints() }]))
  for (const row of rows) {
    if (!row.department) continue
    const department = normalizeDepartmentName(row.department)
    const dept = byDept.get(department) ?? emptyDeptSummary(department)
    dept.actionPoints.total += 1
    if (row.status === "completed") dept.actionPoints.completed += 1
    else if (row.status === "in_progress") dept.actionPoints.inProgress += 1
    else dept.actionPoints.notStarted += 1
    byDept.set(department, dept)
  }
  return Array.from(byDept.values())
}

/**
 * Adds due-this-week and overdue counts from open tasks. `comingWeek` is the
 * seven days from the meeting Monday (getWeeklyTaskWindow of the next week).
 */
export function attachOpenTasks(
  summaries: WeeklyDeptTaskSummary[],
  openTasks: SummaryTaskRow[],
  people: SummaryPersonRow[],
  comingWeek: WeeklyTaskWindow
): WeeklyDeptTaskSummary[] {
  const due = new Map<string, number>()
  const overdue = new Map<string, number>()
  const oldestOverdue = new Map<string, string>()
  for (const task of openTasks) {
    if (!task.assigned_to) continue
    // No created_at: without a real deadline there is nothing to be due or late against.
    const deadline = taskCycleAnchor({ due_date: task.due_date, task_end_date: task.task_end_date, created_at: null })
    if (!deadline) continue
    if (deadline >= comingWeek.startDate && deadline <= comingWeek.endDate) {
      due.set(task.assigned_to, (due.get(task.assigned_to) ?? 0) + 1)
    } else if (deadline < comingWeek.startDate) {
      overdue.set(task.assigned_to, (overdue.get(task.assigned_to) ?? 0) + 1)
      const current = oldestOverdue.get(task.assigned_to)
      if (!current || deadline < current) oldestOverdue.set(task.assigned_to, deadline)
    }
  }

  const byDept = new Map(summaries.map((s) => [s.department, s]))
  const start = Date.parse(`${comingWeek.startDate}T00:00:00Z`)
  for (const person of people) {
    if (!person.department) continue
    const department = normalizeDepartmentName(person.department)
    const dept = byDept.get(department) ?? emptyDeptSummary(department)
    const dueCount = due.get(person.id) ?? 0
    dept.dueThisWeek.total += dueCount
    dept.dueThisWeek.people.push({ id: person.id, name: personName(person), count: dueCount })

    const overdueCount = overdue.get(person.id) ?? 0
    if (overdueCount > 0) {
      dept.overdue.total += overdueCount
      dept.overdue.people.push({ id: person.id, name: personName(person), count: overdueCount })
      const days = Math.round((start - Date.parse(`${oldestOverdue.get(person.id)}T00:00:00Z`)) / DAY_MS)
      dept.overdue.oldestDays = Math.max(dept.overdue.oldestDays ?? 0, days)
    }
    byDept.set(department, dept)
  }

  return Array.from(byDept.values()).map((dept) => ({
    ...dept,
    dueThisWeek: { ...dept.dueThisWeek, people: [...dept.dueThisWeek.people].sort(byCountThenName) },
    overdue: { ...dept.overdue, people: [...dept.overdue.people].sort(byCountThenName) },
  }))
}

/** Adds challenges still open or being mitigated from reports before week `week`. */
export function attachPendingChallenges(
  summaries: WeeklyDeptTaskSummary[],
  rows: SummaryChallengeRow[],
  week: number,
  year: number
): WeeklyDeptTaskSummary[] {
  const byDept = new Map(summaries.map((s) => [s.department, s]))
  for (const row of rows) {
    if (!row.department) continue
    if (row.status !== "open" && row.status !== "mitigating") continue
    const isEarlier = row.year < year || (row.year === year && row.week_number < week)
    if (!isEarlier) continue
    const department = normalizeDepartmentName(row.department)
    const dept = byDept.get(department) ?? emptyDeptSummary(department)
    const pending = dept.pendingChallenges
    pending.total += 1
    if (row.status === "open") pending.open += 1
    else pending.mitigating += 1
    const older =
      !pending.oldest ||
      row.year < pending.oldest.year ||
      (row.year === pending.oldest.year && row.week_number < pending.oldest.week)
    if (older) pending.oldest = { week: row.week_number, year: row.year }
    byDept.set(department, dept)
  }
  return Array.from(byDept.values())
}

/** Client-side: task counts for one report week, ready to pass to the PowerPoint export. */
export async function loadWeeklyTaskSummaryOptions(week: number, year: number): Promise<WeeklyTaskSummaryOptions> {
  const res = await fetch(`/api/reports/weekly-reports/task-summary?week=${week}&year=${year}`)
  if (!res.ok) throw new Error("Could not load task counts for this week")
  const { data } = (await res.json()) as { data: WeeklyDeptTaskSummary[] }
  return { summaries: new Map(data.map((d) => [d.department, d])) }
}
