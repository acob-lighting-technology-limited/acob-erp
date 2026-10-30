"use client"

import type { Dispatch, SetStateAction } from "react"
import { Repeat } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  SERIES_FREQUENCIES,
  SERIES_FREQUENCY_LABELS,
  SERIES_WEEKDAYS,
  WEEKDAY_LABELS,
  describeSchedule,
  type SeriesSchedule,
} from "@/lib/tasks/recurrence"
import type { RepeatChoice, RepeatFormFields } from "@/lib/tasks/series-client"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/**
 * The "Repeat" part of the task form: how often, and on which day. When and
 * whether it ends sits with the dates, in TaskFormDialog. New tasks only - an
 * existing repeat is managed from its series.
 */
export function TaskRepeatFields({
  repeat,
  onChange,
  schedule,
}: {
  repeat: Required<RepeatFormFields>
  onChange: Dispatch<SetStateAction<Required<RepeatFormFields>>>
  /** The schedule these fields describe, or null while "Does not repeat". */
  schedule: SeriesSchedule | null
}) {
  const setRepeatField = <K extends keyof RepeatFormFields>(key: K, value: Required<RepeatFormFields>[K]) =>
    onChange((current) => ({ ...current, [key]: value }))

  return (
    <div className="bg-muted/20 space-y-3 rounded-lg border p-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="repeat" className="flex items-center gap-1.5 text-xs font-semibold">
            <Repeat className="h-3.5 w-3.5" />
            Repeat
          </Label>
          <Select value={repeat.repeat} onValueChange={(val) => setRepeatField("repeat", val as RepeatChoice)}>
            <SelectTrigger id="repeat" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Does not repeat</SelectItem>
              {SERIES_FREQUENCIES.map((frequency) => (
                <SelectItem key={frequency} value={frequency}>
                  {SERIES_FREQUENCY_LABELS[frequency]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {repeat.repeat === "weekly" && (
          <div>
            <Label htmlFor="repeat_weekday" className="text-xs font-semibold">
              Due every
            </Label>
            <Select
              value={String(repeat.repeat_weekday)}
              onValueChange={(val) => setRepeatField("repeat_weekday", Number(val))}
            >
              <SelectTrigger id="repeat_weekday" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERIES_WEEKDAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {WEEKDAY_LABELS[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {repeat.repeat === "yearly" && (
          <div>
            <Label htmlFor="repeat_year_month" className="text-xs font-semibold">
              Month
            </Label>
            <Select
              value={String(repeat.repeat_year_month)}
              onValueChange={(val) => setRepeatField("repeat_year_month", Number(val))}
            >
              <SelectTrigger id="repeat_year_month" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, index) => (
                  <SelectItem key={name} value={String(index + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(repeat.repeat === "monthly" || repeat.repeat === "yearly") && (
          <div>
            <Label htmlFor="repeat_month_day" className="text-xs font-semibold">
              Due on
            </Label>
            <Select
              value={repeat.repeat_month_mode === "last_day" ? "last_day" : String(repeat.repeat_month_day)}
              onValueChange={(val) =>
                onChange((current) =>
                  val === "last_day"
                    ? { ...current, repeat_month_mode: "last_day" }
                    : { ...current, repeat_month_mode: "day", repeat_month_day: Number(val) }
                )
              }
            >
              <SelectTrigger id="repeat_month_day" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_day">Last day of the month</SelectItem>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    Day {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {schedule && (
        <p className="text-muted-foreground text-xs">
          {describeSchedule(schedule)}. A weekend or public holiday moves to the working day before, within the same
          month. Each repeat is created ahead of its due date as an ordinary task, and the series counts as one item in
          the assignee&apos;s KPI.
        </p>
      )}
    </div>
  )
}
