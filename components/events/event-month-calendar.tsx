"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatWATTime, toLocalISODate } from "@/lib/utils/date"
import { EVENT_TYPE_BADGE_CLASSES, type BusyBlock, type CalendarEvent } from "@/lib/events/types"
import { monthGridRange } from "./use-events"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MAX_CHIPS_PER_DAY = 3
const DAY_MS = 86_400_000

type Chip =
  | { kind: "event"; key: string; start: string; event: CalendarEvent }
  | { kind: "busy"; key: string; start: string; block: BusyBlock }

/** WAT calendar days (YYYY-MM-DD) an interval touches; an end at midnight does not spill over. */
function daysTouched(startIso: string, endIso: string): string[] {
  const start = new Date(startIso).getTime()
  const end = Math.max(start, new Date(endIso).getTime() - 1)
  const days: string[] = []
  for (let t = start; t <= end && days.length < 42; t += DAY_MS) days.push(toLocalISODate(new Date(t)))
  const last = toLocalISODate(new Date(end))
  if (!days.includes(last)) days.push(last)
  return days
}

export function EventMonthCalendar({
  year,
  monthIndex,
  onMonthChange,
  events,
  busy,
  isLoading,
  onSelectEvent,
}: {
  year: number
  monthIndex: number
  onMonthChange: (year: number, monthIndex: number) => void
  events: CalendarEvent[]
  busy: BusyBlock[]
  isLoading?: boolean
  onSelectEvent: (event: CalendarEvent) => void
}) {
  const fromMs = monthGridRange(year, monthIndex).from.getTime()
  const today = toLocalISODate()
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
  const monthLabel = new Date(Date.UTC(year, monthIndex, 15)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  const days = useMemo(
    () => Array.from({ length: 42 }, (_, i) => toLocalISODate(new Date(fromMs + i * DAY_MS + 12 * 3_600_000))),
    [fromMs]
  )

  const chipsByDay = useMemo(() => {
    const map = new Map<string, Chip[]>()
    const push = (day: string, chip: Chip) => {
      const list = map.get(day) ?? []
      list.push(chip)
      map.set(day, list)
    }
    for (const event of events) {
      for (const day of daysTouched(event.start_at, event.end_at)) {
        push(day, { kind: "event", key: `${event.id}-${day}`, start: event.start_at, event })
      }
    }
    busy.forEach((block, i) => {
      for (const day of daysTouched(block.start_at, block.end_at)) {
        push(day, { kind: "busy", key: `busy-${i}-${day}`, start: block.start_at, block })
      }
    })
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [events, busy])

  const step = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1))
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth())
  }
  const goToday = () => {
    const [y, m] = today.split("-").map(Number)
    onMonthChange(y, m - 1)
  }

  return (
    <div className="bg-card rounded-xl border-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <h2 className="text-base font-semibold sm:text-lg">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="bg-muted/80 grid grid-cols-7 border-b text-xs font-medium">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-muted-foreground px-2 py-2 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const chips = chipsByDay.get(day) ?? []
              const inMonth = day.startsWith(monthKey)
              const dayNumber = Number(day.slice(8, 10))
              return (
                <div
                  key={day}
                  className={cn("min-h-[104px] border-b p-1.5", i % 7 !== 6 && "border-r", !inMonth && "bg-muted/30")}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        !inMonth && "text-muted-foreground",
                        day === today && "bg-primary text-primary-foreground font-semibold"
                      )}
                    >
                      {dayNumber}
                    </span>
                  </div>
                  {isLoading ? (
                    i % 5 === 0 ? (
                      <Skeleton className="h-5 w-full" />
                    ) : null
                  ) : (
                    <div className="space-y-1">
                      {chips.slice(0, MAX_CHIPS_PER_DAY).map((chip) =>
                        chip.kind === "event" ? (
                          <button
                            key={chip.key}
                            type="button"
                            onClick={() => onSelectEvent(chip.event)}
                            className={cn(
                              "focus-visible:ring-ring block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-4 font-medium focus-visible:ring-2 focus-visible:outline-none",
                              EVENT_TYPE_BADGE_CLASSES[chip.event.type],
                              chip.event.status === "cancelled" && "line-through opacity-60"
                            )}
                            title={chip.event.title}
                          >
                            {!chip.event.all_day && (
                              <span className="mr-1 opacity-80">
                                {formatWATTime(chip.event.start_at, { hour: "numeric", minute: "2-digit" })}
                              </span>
                            )}
                            {chip.event.title}
                          </button>
                        ) : (
                          <div
                            key={chip.key}
                            className="bg-muted text-muted-foreground flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] leading-4"
                            title="The MD is busy"
                          >
                            <Lock className="h-3 w-3 shrink-0" aria-hidden />
                            {chip.block.all_day
                              ? "Busy"
                              : `Busy ${formatWATTime(chip.block.start_at, { hour: "numeric", minute: "2-digit" })}`}
                          </div>
                        )
                      )}
                      {chips.length > MAX_CHIPS_PER_DAY && (
                        <p className="text-muted-foreground px-1.5 text-[11px]">
                          +{chips.length - MAX_CHIPS_PER_DAY} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
