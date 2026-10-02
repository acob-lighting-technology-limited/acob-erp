"use client"

import { useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-client"
import { toLocalISODate } from "@/lib/utils/date"
import { getCurrentOfficeWeek, getOfficeWeekMonday } from "@/lib/meeting-week"
import { addDays, formatMMDDLabel, toMMDD, type Celebrant, type Mode } from "./birthday-utils"

/** Period picker + celebrant fetch shared by every birthday spotlight design. */
export function useBirthdayCelebrants() {
  const today = toLocalISODate()
  const currentOfficeWeek = getCurrentOfficeWeek()

  const [mode, setMode] = useState<Mode>("month")
  const [dayValue, setDayValue] = useState(today)
  const [weekNumber, setWeekNumber] = useState(currentOfficeWeek.week)
  const [weekYear, setWeekYear] = useState(currentOfficeWeek.year)
  const [monthValue, setMonthValue] = useState(String(new Date().getMonth() + 1))
  const [rangeStart, setRangeStart] = useState(today)
  const [rangeEnd, setRangeEnd] = useState(today)

  const [celebrants, setCelebrants] = useState<Celebrant[]>([])
  const [rangeLabel, setRangeLabel] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerated, setIsGenerated] = useState(false)

  const yearOptions = useMemo(
    () => [currentOfficeWeek.year - 1, currentOfficeWeek.year, currentOfficeWeek.year + 1],
    [currentOfficeWeek.year]
  )

  function computeRange(): { start: string; end: string; label: string } {
    if (mode === "day") {
      const mmdd = toMMDD(new Date(`${dayValue}T00:00:00`))
      return { start: mmdd, end: mmdd, label: formatMMDDLabel(mmdd) }
    }
    if (mode === "week") {
      // Uses the same office-week numbering as /admin/reports/general-meeting
      const monday = getOfficeWeekMonday(weekNumber, weekYear)
      const sunday = addDays(monday, 6)
      return {
        start: toMMDD(monday),
        end: toMMDD(sunday),
        label: `Week ${weekNumber} · ${formatMMDDLabel(toMMDD(monday))} – ${formatMMDDLabel(toMMDD(sunday))}`,
      }
    }
    if (mode === "month") {
      const m = Number(monthValue)
      const lastDay = new Date(2001, m, 0).getDate()
      const start = `${String(m).padStart(2, "0")}-01`
      const end = `${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      return { start, end, label: `${formatMMDDLabel(start)} – ${formatMMDDLabel(end)}` }
    }
    const start = toMMDD(new Date(`${rangeStart}T00:00:00`))
    const end = toMMDD(new Date(`${rangeEnd}T00:00:00`))
    return { start, end, label: `${formatMMDDLabel(start)} – ${formatMMDDLabel(end)}` }
  }

  async function generate() {
    const { start, end, label } = computeRange()
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiFetch(`/api/admin/hr/birthdays?start=${start}&end=${end}&photo=large`)
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Failed to load birthdays")
      setCelebrants(payload?.data || [])
      setRangeLabel(label)
      setIsGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load birthdays")
      setCelebrants([])
    } finally {
      setIsLoading(false)
    }
  }

  return {
    mode,
    setMode,
    dayValue,
    setDayValue,
    weekNumber,
    setWeekNumber,
    weekYear,
    setWeekYear,
    yearOptions,
    monthValue,
    setMonthValue,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    celebrants,
    rangeLabel,
    isLoading,
    error,
    isGenerated,
    generate,
    reset: () => setIsGenerated(false),
  }
}

export type BirthdayCelebrantsState = ReturnType<typeof useBirthdayCelebrants>
