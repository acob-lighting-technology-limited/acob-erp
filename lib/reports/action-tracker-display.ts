import { getOfficeWeekMonday } from "@/lib/meeting-week"
import { formatWATDateTime } from "@/lib/utils/date"

/** The fields of an action item these helpers read. */
type TrackedItem = { status: string; due_date?: string | null; week_number: number; year: number }

export type DepartmentSummaryStatus = "Finished" | "Started" | "Not Started" | "Pending"

/** An explicit due date, else the end of the item's office week (Sunday 23:59). */
export function resolveDueDate(task: TrackedItem) {
  if (task.due_date) {
    const explicitDueDate = new Date(task.due_date)
    if (!Number.isNaN(explicitDueDate.getTime())) return explicitDueDate
  }
  const sunday = getOfficeWeekMonday(task.week_number, task.year)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 0, 0)
  return sunday
}

export function formatDueDate(task: TrackedItem) {
  return formatWATDateTime(resolveDueDate(task), { day: "2-digit", month: "short", year: "numeric" })
}

/** Green when done, red when overdue, amber otherwise. */
export function getDueDateClassName(task: TrackedItem) {
  if (task.status.toLowerCase() === "completed") return "font-medium text-success-foreground"
  if (resolveDueDate(task).getTime() < Date.now()) return "font-semibold text-danger-foreground"
  return "font-semibold text-warning-foreground"
}

/** One status for a department's whole list of items. */
export function getDeptSummaryStatus(tasks: TrackedItem[]): DepartmentSummaryStatus {
  if (tasks.length === 0) return "Pending"
  if (tasks.every((task) => task.status === "completed")) return "Finished"
  if (tasks.some((task) => task.status === "in_progress" || task.status === "completed")) return "Started"
  if (tasks.some((task) => task.status === "not_started")) return "Not Started"
  return "Pending"
}

export function getItemStatusBadgeClass(status: string) {
  if (status === "completed") return "bg-success-muted text-success-foreground"
  if (status === "in_progress") return "bg-info-muted text-info-foreground"
  if (status === "not_started") return "bg-warning-muted text-warning-foreground"
  return "bg-neutral-muted text-neutral-foreground"
}

export function getSummaryBadgeClass(status: DepartmentSummaryStatus) {
  if (status === "Finished") return "bg-success-muted text-success-foreground"
  if (status === "Started") return "bg-info-muted text-info-foreground"
  if (status === "Not Started") return "bg-warning-muted text-warning-foreground"
  return "bg-neutral-muted text-neutral-foreground"
}
