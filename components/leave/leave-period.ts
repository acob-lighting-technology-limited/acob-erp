const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Parses a YYYY-MM-DD date without timezone shifts. */
function parts(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  return { year: y, month: m, day: d }
}

/**
 * A leave period written as people say it: "7 – 7 Oct 2026" within a month,
 * "28 Oct – 3 Nov 2026" across months. Falls back to the raw dates if they cannot be read.
 */
export function formatLeavePeriod(start: string, end: string): string {
  const s = parts(start)
  const e = parts(end)
  if (!s.year || !s.month || !s.day || !e.year || !e.month || !e.day) return `${start} to ${end}`
  if (s.year === e.year && s.month === e.month && s.day === e.day) {
    return `${s.day} ${MONTHS[s.month - 1]} ${s.year}`
  }
  if (s.year === e.year && s.month === e.month) {
    return `${s.day} – ${e.day} ${MONTHS[s.month - 1]} ${s.year}`
  }
  return `${s.day} ${MONTHS[s.month - 1]}${s.year === e.year ? "" : ` ${s.year}`} – ${e.day} ${MONTHS[e.month - 1]} ${e.year}`
}
