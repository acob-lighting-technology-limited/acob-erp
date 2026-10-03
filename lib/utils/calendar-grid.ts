/**
 * Month-grid helpers shared by the attendance and leave calendars. Weeks start
 * on Monday (the office week), and every date is a local "YYYY-MM-DD" string.
 */

/** JS getDay() (Sunday = 0) → Monday-based index (Monday = 0, Sunday = 6). */
export function monBasedDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

/** "2026-10" → "October 2026". */
export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
}

/** Step a "YYYY-MM" by `delta` months. */
export function navigateMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** A Monday-first grid for the month: leading/trailing nulls pad it to whole weeks. */
export function buildCalendarCells(yearMonth: string): (string | null)[] {
  const [year, month] = yearMonth.split("-").map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const offset = monBasedDay(new Date(year, month - 1, 1).getDay())
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
    ),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
