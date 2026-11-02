/** Birthday helpers shared by the HR birthdays API and the weekly reminder. Birthdays are stored as MM-DD. */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const MMDD_PATTERN = /^\d{2}-\d{2}$/

/** Inclusive MM-DD range check that handles wraparound (e.g. Dec 28 – Jan 3). */
export function isBirthdayInRange(mmdd: string, start: string, end: string): boolean {
  if (start <= end) return mmdd >= start && mmdd <= end
  return mmdd >= start || mmdd <= end
}

/** Days covered by an inclusive MM-DD range, wrapping over New Year (counted on a leap year). */
export function birthdayRangeDays(start: string, end: string): number {
  const dayOfYear = (mmdd: string) => {
    const [month, day] = mmdd.split("-").map(Number)
    return (Date.UTC(2024, month - 1, day) - Date.UTC(2024, 0, 1)) / 86_400_000
  }
  const span = dayOfYear(end) - dayOfYear(start)
  return (span < 0 ? span + 366 : span) + 1
}

export interface BirthdayWeekDay {
  /** YYYY-MM-DD */
  iso: string
  /** MM-DD, comparable with profiles.birthday */
  mmdd: string
  /** "Mon 3 Nov" */
  label: string
}

/**
 * The Monday-to-Sunday week containing `isoDate` (YYYY-MM-DD, already in WAT).
 * Calendar maths runs in UTC so the host's timezone cannot shift a day.
 */
export function birthdayWeekOf(isoDate: string): { monday: string; days: BirthdayWeekDay[]; label: string } {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))

  const days: BirthdayWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date)
    d.setUTCDate(date.getUTCDate() + i)
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(d.getUTCDate()).padStart(2, "0")
    return {
      iso: `${d.getUTCFullYear()}-${mm}-${dd}`,
      mmdd: `${mm}-${dd}`,
      label: `${WEEKDAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`,
    }
  })
  const short = (d: BirthdayWeekDay) => d.label.slice(4)
  return { monday: days[0].iso, days, label: `${short(days[0])} – ${short(days[6])}` }
}
