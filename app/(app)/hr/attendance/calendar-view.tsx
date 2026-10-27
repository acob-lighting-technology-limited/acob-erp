"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toLocalISODate, toLocalYearMonth } from "@/lib/hr/attendance-utils"
import { computeAttendanceDay } from "@/lib/hr/attendance-ssot"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/hr/attendance-status"
import type { AttendanceRecord } from "./page"
import { apiJson } from "@/lib/api-client"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { buildCalendarCells, formatMonthLabel, navigateMonth } from "@/lib/utils/calendar-grid"
import { CalendarGridSkeleton } from "@/components/skeletons/section-skeletons"

type DayStatus =
  | "present"
  | "late"
  | "lateness_with_permission"
  | "absent"
  | "absent_with_permission"
  | "out_of_station"
  | "incomplete"
  | "waiver"
  | "exempted"
  | "on_leave"
  | "holiday"
  | "weekend"

interface UnifiedDay {
  date: string
  record: AttendanceRecord | null
  status: DayStatus
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function formatTime(t: string | null | undefined) {
  if (!t) return ""
  return t.substring(0, 5)
}

const CELL_BG: Record<string, string> = {
  early: "bg-success/80 border-success/30",
  present: "bg-info/80 border-info/30",
  late: "bg-warning/80 border-warning/30",
  lateness_with_permission: "bg-warning/80 border-warning/30",
  incomplete_with_permission: "bg-success/80 border-success/30",
  early_departure: "bg-warning/80 border-warning/30",
  early_departure_with_permission: "bg-warning/80 border-warning/30",
  early_closure: "bg-info/80 border-info/30",
  late_resumption: "bg-info/80 border-info/30",
  incomplete: "bg-info/80 border-info/30",
  absent: "bg-danger/80 border-danger/30",
  absent_with_permission: "bg-danger/80 border-danger/30",
  out_of_station: "bg-info/80 border-info/30",
  waiver: "bg-info/80 border-info/30",
  waived: "bg-info/80 border-info/30",
  exempted: "bg-purple/80 border-purple/30",
  on_leave: "bg-purple/80 border-purple/30",
  holiday: "bg-info/80 border-info/30",
  weekend: "bg-muted/60 border-border",
  no_record: "bg-muted/80 border-border",
  half_day: "bg-warning/80 border-warning/30",
}

function shortStatusLabel(status: string, fullLabel: string): string {
  switch (status) {
    case "lateness_with_permission":
      return "LWP"
    case "incomplete_with_permission":
      return "IWP"
    case "absent_with_permission":
      return "AWP"
    case "out_of_station":
      return "Out"
    case "incomplete":
      return "Inc"
    case "on_leave":
      return "Leave"
    default:
      return fullLabel
  }
}

export function EmployeeCalendarView() {
  const [calendarMonth, setCalendarMonth] = useState(toLocalYearMonth())
  const { data: days = null, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.myAttendanceDays(calendarMonth),
    queryFn: async () => {
      const payload = await apiJson<{ data?: UnifiedDay[] }>(`/api/hr/attendance/my-days?year_month=${calendarMonth}`, {
        cache: "no-store",
      })
      return payload.data ?? []
    },
    meta: { errorMessage: "Failed to load calendar data" },
  })

  const today = toLocalISODate()
  const currentYearMonth = toLocalYearMonth()
  const cells = buildCalendarCells(calendarMonth)
  const daysByDate = new Map<string, UnifiedDay>((days ?? []).map((d) => [d.date, d]))

  // Monthly work & missed hours for the selected calendar month
  const { monthWorkedHours, monthMissedHours } = useMemo(() => {
    if (!days || days.length === 0) return { monthWorkedHours: null, monthMissedHours: null }
    const todayIso = toLocalISODate()
    const scorable = days.filter((d) => {
      const s = d.status
      if (s === "weekend" || s === "holiday" || s === "on_leave" || s === "exempted" || s === "waiver") return false
      // Exclude a day still in progress (clocked in today, not yet clocked out)
      if (d.date === todayIso && d.record?.clock_in && !d.record?.clock_out) return false
      return true
    })
    if (scorable.length === 0) return { monthWorkedHours: null, monthMissedHours: null }
    let workedSum = 0
    let missedSum = 0
    for (const d of scorable) {
      const dayResult = computeAttendanceDay({
        status: d.status,
        clockIn: d.record?.clock_in ?? null,
        clockOut: d.record?.clock_out ?? null,
      })
      workedSum += dayResult.hoursWorked
      missedSum += dayResult.hoursLost
    }
    return {
      monthWorkedHours: Math.round(workedSum * 10) / 10,
      monthMissedHours: Math.round(missedSum * 10) / 10,
    }
  }, [days])

  return (
    <div>
      {/* Month navigator + monthly hour stats */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            aria-label="Previous"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCalendarMonth((m) => navigateMonth(m, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{formatMonthLabel(calendarMonth)}</span>
          <Button
            aria-label="Next"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCalendarMonth((m) => navigateMonth(m, 1))}
            disabled={calendarMonth >= currentYearMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!loading && monthWorkedHours !== null && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-card text-card-foreground min-w-[80px] rounded-lg border px-2 py-1 text-center shadow-xs sm:min-w-[90px] sm:px-3 sm:py-1.5">
              <p className="text-muted-foreground mb-0.5 text-xs leading-none sm:mb-1 sm:text-xs">Work Hours</p>
              <p className="text-xs leading-none font-semibold text-emerald-600 sm:text-sm">{monthWorkedHours} hrs</p>
            </div>
            <div className="bg-card text-card-foreground min-w-[80px] rounded-lg border px-2 py-1 text-center shadow-xs sm:min-w-[90px] sm:px-3 sm:py-1.5">
              <p className="text-muted-foreground mb-0.5 text-xs leading-none sm:mb-1 sm:text-xs">Missed Hours</p>
              <p className="text-xs leading-none font-semibold text-amber-600 sm:text-sm">{monthMissedHours} hrs</p>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <CalendarGridSkeleton />
      ) : (
        <div className="bg-card text-card-foreground overflow-hidden rounded-lg border shadow-xs">
          {/* Day-of-week headers */}
          <div className="bg-muted/40 grid grid-cols-7 border-b">
            {DAY_HEADERS.map((d) => (
              <div
                key={d}
                className="text-muted-foreground py-1.5 text-center text-xs font-semibold sm:py-2 sm:text-xs"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              const isLastInRow = (i + 1) % 7 === 0
              if (!date) {
                return (
                  <div
                    key={`empty-${i}`}
                    className={`bg-muted/20 min-h-14 border-b p-0.5 sm:min-h-16 sm:p-1 ${isLastInRow ? "" : "border-r"}`}
                  />
                )
              }
              const day = daysByDate.get(date)
              const status = day?.status
              const isFuture = date > today
              const bg = !isFuture && status && CELL_BG[status] ? CELL_BG[status] : ""
              const clockIn = formatTime(day?.record?.clock_in)
              const clockOut = formatTime(day?.record?.clock_out)
              const timeLabel = clockIn ? (clockOut ? `${clockIn} – ${clockOut}` : clockIn) : ""
              const fullLabel = status
                ? (ATTENDANCE_STATUS_LABELS[status as keyof typeof ATTENDANCE_STATUS_LABELS] ?? status)
                : ""

              return (
                <div
                  key={date}
                  className={`min-h-14 border-b p-1 text-xs sm:min-h-16 sm:p-1.5 ${isLastInRow ? "" : "border-r"} ${bg}`}
                >
                  <div
                    className={`mb-0.5 text-xs font-medium sm:text-xs ${date === today ? "text-primary font-bold" : "text-muted-foreground"}`}
                  >
                    {date.slice(8)}
                  </div>
                  {!isFuture && day && status && status !== "weekend" && (
                    <>
                      <Badge
                        className={`max-w-full truncate px-1 py-0 text-[9px] font-medium sm:text-[10px] ${
                          ATTENDANCE_STATUS_COLORS[status as keyof typeof ATTENDANCE_STATUS_COLORS] ??
                          "bg-muted text-foreground"
                        }`}
                      >
                        <span className="sm:hidden">{shortStatusLabel(status, fullLabel)}</span>
                        <span className="hidden sm:inline">{fullLabel}</span>
                      </Badge>
                      {timeLabel && (
                        <div className="text-muted-foreground mt-0.5 text-xs leading-tight sm:text-xs">{timeLabel}</div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.entries(ATTENDANCE_STATUS_LABELS) as [string, string][])
          .filter(([key]) => key !== "waived" && key !== "no_record")
          .map(([key, label]) => (
            <Badge
              key={key}
              className={`text-xs ${ATTENDANCE_STATUS_COLORS[key as keyof typeof ATTENDANCE_STATUS_COLORS] ?? "bg-gray-100 text-gray-800"}`}
            >
              {label}
            </Badge>
          ))}
      </div>
    </div>
  )
}
