import { addIsoDays } from "@/lib/hr/leave-days"
import { toLocalISODate } from "@/lib/utils/date"

/**
 * Default order of the Daily Roster.
 *
 * The roster is a live check: through the working day Admin & HR open it to see
 * who has clocked in (many staff are on site, out of sight), and after closing
 * to see who has clocked out. So for the current working day the newest punch
 * of the current phase goes first - arrivals until closing time, departures
 * after it - and people with no such punch yet sink to the bottom. A past day
 * keeps the departures order it ended on (newest clock-out first) rather than
 * resetting to alphabetical — HR reads yesterday the way they left it.
 *
 * Closing time is the day's own (an early closure, else the policy's end time),
 * so the switch follows the actual close rather than a fixed 5pm. The working
 * day rolls over at 04:00, matching the device's after-midnight exit handling.
 */

export type RosterPhase = "arrivals" | "departures"

/** Before this (WAT), the night still belongs to the previous working day. */
export const WORKING_DAY_ROLLOVER = "04:00"
const DEFAULT_CLOSE_TIME = "17:00"

function watClock(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now)
}

/** Which phase the roster for `rosterDate` is in at `now`, or null for a past day. */
export function rosterPhase(params: { rosterDate: string; now: Date; closeTime: string | null }): RosterPhase | null {
  const clock = watClock(params.now)
  const calendarToday = toLocalISODate(params.now)
  const workingDay = clock < WORKING_DAY_ROLLOVER ? addIsoDays(calendarToday, -1) : calendarToday
  const close = (params.closeTime || DEFAULT_CLOSE_TIME).slice(0, 5)

  if (params.rosterDate === workingDay) {
    return clock >= WORKING_DAY_ROLLOVER && clock < close ? "arrivals" : "departures"
  }
  // Small hours: the calendar day has begun but nobody is due in yet.
  if (params.rosterDate === calendarToday) return "arrivals"
  return null
}

type RosterRow = { clock_in: string | null; clock_out: string | null; user_name?: string | null }

/** Rows in the phase's default order; a past day (phase null) uses the departures order. */
export function orderRoster<T extends RosterRow>(rows: T[], phase: RosterPhase | null): T[] {
  const byName = (a: T, b: T) => String(a.user_name ?? "").localeCompare(String(b.user_name ?? ""))
  const punch = (row: T) => (phase === "arrivals" ? row.clock_in : row.clock_out) || ""
  return [...rows].sort((a, b) => {
    const pa = punch(a)
    const pb = punch(b)
    if (pa && !pb) return -1
    if (!pa && pb) return 1
    if (pa !== pb) return pb.localeCompare(pa)
    return byName(a, b)
  })
}
