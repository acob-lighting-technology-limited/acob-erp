const OFFICE_WEEK_ANCHOR_YEAR = 2026
const OFFICE_WEEK_ANCHOR_MONTH_INDEX = 0 // January
const OFFICE_WEEK_ANCHOR_DAY = 12

function getOfficeYearStart(year: number): Date {
  return new Date(year, OFFICE_WEEK_ANCHOR_MONTH_INDEX, OFFICE_WEEK_ANCHOR_DAY)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function getWeeksInOfficeYear(year: number): number {
  const start = getOfficeYearStart(year)
  const nextStart = getOfficeYearStart(year + 1)
  const diffMs = nextStart.getTime() - start.getTime()
  return Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000))
}

export function getOfficeWeekFromDate(date: Date): { week: number; year: number } {
  const input = new Date(date)
  let year = input.getFullYear()
  let yearStart = getOfficeYearStart(year)

  if (input < yearStart) {
    year -= 1
    yearStart = getOfficeYearStart(year)
  }

  const diffMs = input.getTime() - yearStart.getTime()
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1

  return { week, year }
}

export function getCurrentOfficeWeek(date: Date = new Date()): { week: number; year: number } {
  return getOfficeWeekFromDate(date)
}

export function getOfficeWeekMonday(week: number, year: number): Date {
  const yearStart = getOfficeYearStart(year)
  return addDays(yearStart, (week - 1) * 7)
}

export function formatOfficeDateWithOrdinal(date: Date): string {
  const day = date.getDate()
  const suffix = [1, 21, 31].includes(day) ? "st" : [2, 22].includes(day) ? "nd" : [3, 23].includes(day) ? "rd" : "th"
  const month = date.toLocaleString("en-GB", { month: "long" })
  return `${day}${suffix} ${month}, ${date.getFullYear()}`
}
