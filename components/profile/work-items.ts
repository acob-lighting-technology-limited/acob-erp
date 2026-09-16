import type { Task, HelpDeskItem, CorrespondenceItem, PaymentItem } from "@/app/(app)/profile/page"
import { calendarDaysBetween, taskDeadline } from "@/lib/tasks/overdue"
import { toLocalISODate } from "@/lib/utils/date"

export const DUE_SOON_WINDOW_DAYS = 3

export const OPEN_TASK_STATUSES = new Set(["pending", "in_progress", "submitted_for_review", "unable_to_complete"])
export const TERMINAL_TASK_STATUSES = new Set(["completed", "reassigned", "cancelled", "failed"])
const TERMINAL_HELP_DESK_STATUSES = new Set(["resolved", "closed", "cancelled", "rejected"])
const TERMINAL_CORRESPONDENCE_STATUSES = new Set(["filed", "closed", "cancelled"])
const PENDING_PAYMENT_STATUSES = new Set(["due", "overdue"])

export function isTaskTerminal(taskOrStatus: Task | string | null | undefined): boolean {
  if (!taskOrStatus) return false
  if (typeof taskOrStatus === "object") {
    if (taskOrStatus.user_completed) return true
    return isTaskTerminal(taskOrStatus.status)
  }
  return TERMINAL_TASK_STATUSES.has(taskOrStatus)
}

export function isOpenTask(task: Task): boolean {
  if (task.user_completed || TERMINAL_TASK_STATUSES.has(task.status)) return false
  return OPEN_TASK_STATUSES.has(task.status)
}

export function isOpenTicket(ticket: HelpDeskItem): boolean {
  return !TERMINAL_HELP_DESK_STATUSES.has(ticket.status)
}

export function isOpenCorrespondence(item: CorrespondenceItem): boolean {
  return !TERMINAL_CORRESPONDENCE_STATUSES.has(item.status)
}

export function isPendingPayment(payment: PaymentItem): boolean {
  return PENDING_PAYMENT_STATUSES.has(payment.status)
}

export type TaskUrgency =
  | { kind: "overdue"; days: number }
  | { kind: "due_soon"; days: number }
  | { kind: "scheduled"; dueDate: string }
  | { kind: "no_date" }

/**
 * Urgency is measured in whole WAT calendar days, not in elapsed milliseconds.
 * A `date` column arrives as "2026-09-24", which `new Date()` reads as UTC
 * midnight — an hour before WAT midnight — so comparing it against the current
 * instant turned a task red at 01:00 on the day it was due, a day before the
 * nightly job would fail it and a day before every other task screen agreed.
 */
export function getTaskUrgency(task: Task, now: Date): TaskUrgency {
  // task_end_date wins over due_date, matching the nightly expiry job and the
  // project health rollup - a plan task carries both, and measuring the badge
  // against the wrong one would put the screen a day out from the job again.
  const deadline = taskDeadline(task)
  if (!deadline) return { kind: "no_date" }
  if (isTaskTerminal(task)) return { kind: "scheduled", dueDate: deadline }
  const days = calendarDaysBetween(toLocalISODate(now), deadline)
  if (days < 0) return { kind: "overdue", days: -days }
  if (days <= DUE_SOON_WINDOW_DAYS) return { kind: "due_soon", days }
  return { kind: "scheduled", dueDate: deadline }
}

const URGENCY_RANK: Record<TaskUrgency["kind"], number> = {
  overdue: 0,
  due_soon: 1,
  scheduled: 2,
  no_date: 3,
}

/** Open tasks sorted most-urgent first (overdue → due soon → scheduled → undated). */
export function sortTasksByUrgency(tasks: Task[], now: Date): Task[] {
  return tasks
    .filter(isOpenTask)
    .map((task) => ({ task, urgency: getTaskUrgency(task, now) }))
    .sort((a, b) => {
      const rankDiff = URGENCY_RANK[a.urgency.kind] - URGENCY_RANK[b.urgency.kind]
      if (rankDiff !== 0) return rankDiff
      const aDue = taskDeadline(a.task) ?? "9999-12-31"
      const bDue = taskDeadline(b.task) ?? "9999-12-31"
      return aDue < bDue ? -1 : aDue > bDue ? 1 : 0
    })
    .map(({ task }) => task)
}

export function countOverdueTasks(tasks: Task[], now: Date): number {
  return tasks.filter((task) => isOpenTask(task) && getTaskUrgency(task, now).kind === "overdue").length
}

export function countDueSoonTasks(tasks: Task[], now: Date): number {
  return tasks.filter((task) => isOpenTask(task) && getTaskUrgency(task, now).kind === "due_soon").length
}
