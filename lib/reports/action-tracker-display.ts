import { getOfficeWeekMonday } from "@/lib/meeting-week"
import { normalizeDepartmentName } from "@/shared/departments"
import { formatWATDateTime } from "@/lib/utils/date"
import { TONE_CLASSES } from "@/lib/ui/status-tones"

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
  if (task.status.toLowerCase() === "completed") return "font-medium text-success"
  if (resolveDueDate(task).getTime() < Date.now()) return "font-semibold text-danger"
  return "font-semibold text-warning"
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
  if (status === "completed") return TONE_CLASSES.success
  if (status === "in_progress") return TONE_CLASSES.info
  if (status === "not_started") return TONE_CLASSES.warning
  return TONE_CLASSES.neutral
}

export function getSummaryBadgeClass(status: DepartmentSummaryStatus) {
  if (status === "Finished") return TONE_CLASSES.success
  if (status === "Started") return TONE_CLASSES.info
  if (status === "Not Started") return TONE_CLASSES.warning
  return TONE_CLASSES.neutral
}

/** A department's action-tracker status for the week, with its badge colour (weekly-report tables). */
export function getDepartmentTrackerStatus(department: string, items: Array<{ department: string; status: string }>) {
  const normalized = normalizeDepartmentName(department)
  const deptItems = items.filter((item) => normalizeDepartmentName(item.department) === normalized)
  const label = getDeptSummaryStatus(deptItems)
  return { label, color: getSummaryBadgeClass(label) }
}
