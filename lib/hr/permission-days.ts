const PERMISSION_STATUSES = new Set([
  "lateness_with_permission",
  "incomplete_with_permission",
  "absent_with_permission",
])

/**
 * Permission days (LWP / IWP / AWP) used in a month, for the "x of 3 used" count.
 * A day whose appeal ended "resolved" is not one: it was closed outside the appeal, because the
 * clock-in device failed or Admin & HR corrected the day. Mirrors validateLwpAwpMonthlyQuota.
 */
export function countPermissionDaysInMonth(
  days: Array<{ date: string; status: string | null }>,
  appeals: Array<{ appeal_date: string; status: string }>,
  yearMonth: string
): number {
  const resolved = new Set(appeals.filter((a) => a.status === "resolved").map((a) => a.appeal_date))
  return days.filter(
    (day) => day.date.startsWith(yearMonth) && !resolved.has(day.date) && PERMISSION_STATUSES.has(String(day.status))
  ).length
}
