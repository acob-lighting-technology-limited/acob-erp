"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import { CalendarRange, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatWATDate } from "@/lib/utils/date"

export type DateTimeRange = {
  start_date: string
  end_date: string
  start_time: string
  end_time: string
}

function dateLabel(value: string): string {
  return value ? formatWATDate(`${value}T12:00:00+01:00`, { day: "numeric", month: "short" }) : "…"
}

/** One-line summary for the trigger and the active-filter pill. */
export function describeDateTimeRange(range: DateTimeRange): string {
  const dates =
    range.start_date === range.end_date
      ? dateLabel(range.start_date)
      : `${dateLabel(range.start_date)} – ${dateLabel(range.end_date)}`
  if (!range.start_time && !range.end_time) return dates
  return `${dates} · ${range.start_time || "00:00"}–${range.end_time || "23:59"}`
}

/**
 * A start/end date and time window as a single filter control.
 *
 * Table pages allow at most four filters (AGENTS.md), and a date range expressed
 * as separate Start Date / End Date / Start Time / End Time dropdowns used four on
 * its own. This keeps the same inputs behind one trigger.
 */
export function DateTimeRangeFilter({
  value,
  onChange,
  showTime = true,
  label = "Date & time",
  className,
}: {
  value: DateTimeRange
  onChange: (next: DateTimeRange) => void
  showTime?: boolean
  label?: string
  className?: string
}) {
  const set = (key: keyof DateTimeRange, next: string) => onChange({ ...value, [key]: next })

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "border-input focus:ring-ring flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarRange className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{describeDateTimeRange(value)}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="bg-popover text-popover-foreground z-50 w-72 space-y-3 rounded-md border p-3 shadow-md"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="dtr-start-date" className="text-xs">
                From
              </Label>
              <Input
                id="dtr-start-date"
                type="date"
                value={value.start_date}
                max={value.end_date || undefined}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dtr-end-date" className="text-xs">
                To
              </Label>
              <Input
                id="dtr-end-date"
                type="date"
                value={value.end_date}
                min={value.start_date || undefined}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </div>
          </div>
          {showTime && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="dtr-start-time" className="text-xs">
                  From time
                </Label>
                <Input
                  id="dtr-start-time"
                  type="time"
                  value={value.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dtr-end-time" className="text-xs">
                  To time
                </Label>
                <Input
                  id="dtr-end-time"
                  type="time"
                  value={value.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                />
              </div>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
