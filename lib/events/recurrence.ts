import { toLocalISODate } from "@/lib/utils/date"
import type { EventRecurrenceFrequency } from "./types"

const DAY_MS = 86_400_000
const WAT_OFFSET = "+01:00"

export type GenerateOccurrencesOptions = {
  start_at: string
  end_at: string
  all_day: boolean
  frequency: EventRecurrenceFrequency
  count?: number
  until?: string | null
  holidayDates: Set<string>
  skip_holidays?: boolean
}

export type GeneratedOccurrencesResult = {
  scheduled: Array<{ start_at: string; end_at: string }>
  skippedHolidays: string[]
}

function daysInMonth(year: number, monthZeroIndex: number): number {
  return new Date(Date.UTC(year, monthZeroIndex + 1, 0)).getUTCDate()
}

/**
 * Computes the start and end ISO strings for occurrence `stepIndex` (0 is the base occurrence).
 */
function computeOccurrenceRange(
  baseStart: Date,
  durationMs: number,
  frequency: EventRecurrenceFrequency,
  stepIndex: number,
  all_day: boolean
): { start: Date; end: Date } {
  if (stepIndex === 0) {
    return { start: baseStart, end: new Date(baseStart.getTime() + durationMs) }
  }

  if (frequency === "daily") {
    const start = new Date(baseStart.getTime() + stepIndex * DAY_MS)
    return { start, end: new Date(start.getTime() + durationMs) }
  }

  if (frequency === "weekly") {
    const start = new Date(baseStart.getTime() + stepIndex * 7 * DAY_MS)
    return { start, end: new Date(start.getTime() + durationMs) }
  }

  if (frequency === "biweekly") {
    const start = new Date(baseStart.getTime() + stepIndex * 14 * DAY_MS)
    return { start, end: new Date(start.getTime() + durationMs) }
  }

  if (frequency === "monthly") {
    // WAT has no daylight savings, so parse local components
    const startWatStr = toLocalISODate(baseStart)
    const [yStr, mStr, dStr] = startWatStr.split("-").map(Number)
    const targetMonthTotal = mStr - 1 + stepIndex
    const targetYear = yStr + Math.floor(targetMonthTotal / 12)
    const targetMonth = ((targetMonthTotal % 12) + 12) % 12
    const maxDay = daysInMonth(targetYear, targetMonth)
    const targetDay = Math.min(dStr, maxDay)

    const mm = String(targetMonth + 1).padStart(2, "0")
    const dd = String(targetDay).padStart(2, "0")

    if (all_day) {
      const start = new Date(`${targetYear}-${mm}-${dd}T00:00:00${WAT_OFFSET}`)
      return { start, end: new Date(start.getTime() + durationMs) }
    }

    const hours = String(new Date(baseStart.getTime() + 3_600_000).getUTCHours()).padStart(2, "0")
    const minutes = String(baseStart.getUTCMinutes()).padStart(2, "0")
    const start = new Date(`${targetYear}-${mm}-${dd}T${hours}:${minutes}:00${WAT_OFFSET}`)
    return { start, end: new Date(start.getTime() + durationMs) }
  }

  return { start: baseStart, end: new Date(baseStart.getTime() + durationMs) }
}

export function generateEventOccurrences({
  start_at,
  end_at,
  all_day,
  frequency,
  count = 4,
  until,
  holidayDates,
  skip_holidays = true,
}: GenerateOccurrencesOptions): GeneratedOccurrencesResult {
  if (frequency === "none") {
    return {
      scheduled: [{ start_at, end_at }],
      skippedHolidays: [],
    }
  }

  const baseStart = new Date(start_at)
  const baseEnd = new Date(end_at)
  const durationMs = baseEnd.getTime() - baseStart.getTime()

  const scheduled: Array<{ start_at: string; end_at: string }> = []
  const skippedHolidays: string[] = []

  const maxSteps = Math.min(Math.max(count || 1, 1), 52)
  const untilLimit = until ? new Date(`${until}T23:59:59${WAT_OFFSET}`).getTime() : null

  for (let i = 0; i < maxSteps; i++) {
    const { start, end } = computeOccurrenceRange(baseStart, durationMs, frequency, i, all_day)

    if (untilLimit !== null && start.getTime() > untilLimit) {
      break
    }

    const dateIso = toLocalISODate(start)
    if (skip_holidays && holidayDates.has(dateIso)) {
      skippedHolidays.push(dateIso)
      continue
    }

    scheduled.push({
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    })
  }

  return { scheduled, skippedHolidays }
}
