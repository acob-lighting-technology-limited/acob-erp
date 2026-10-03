import { getOfficeWeekMonday } from "@/lib/meeting-week"
import { normalizeDepartmentName } from "@/shared/departments"
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
  if (task.status.toLowerCase() === "completed") return "font-medium text-green-600 dark:text-green-400"
  if (resolveDueDate(task).getTime() < Date.now()) return "font-semibold text-red-600 dark:text-red-400"
  return "font-semibold text-yellow-600 dark:text-yellow-400"
}

/** One status for a department's whole list of items. */
export function getDeptSummaryStatus(tasks: Array<{ status: string }>): DepartmentSummaryStatus {
  if (tasks.length === 0) return "Pending"
  if (tasks.every((task) => task.status === "completed")) return "Finished"
  if (tasks.some((task) => task.status === "in_progress" || task.status === "completed")) return "Started"
  if (tasks.some((task) => task.status === "not_started")) return "Not Started"
  return "Pending"
}

export function getItemStatusBadgeClass(status: string) {
  if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  if (status === "in_progress") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  if (status === "not_started") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
  return "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
}

export function getSummaryBadgeClass(status: DepartmentSummaryStatus) {
  if (status === "Finished") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  if (status === "Started") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  if (status === "Not Started") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
  return "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
}

/** A department's action-tracker status for the week, with its badge colour (weekly-report tables). */
export function getDepartmentTrackerStatus(department: string, items: Array<{ department: string; status: string }>) {
  const normalized = normalizeDepartmentName(department)
  const deptItems = items.filter((item) => normalizeDepartmentName(item.department) === normalized)
  const label = getDeptSummaryStatus(deptItems)
  return { label, color: getSummaryBadgeClass(label) }
}
