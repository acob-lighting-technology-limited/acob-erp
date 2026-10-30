"use client"

import { Repeat } from "lucide-react"
import type { DataTableFilter } from "@/components/ui/data-table"
import { repeatBadgeLabel } from "@/lib/tasks/recurrence"

type SeriesLinked = { series_id?: string | null; series_frequency?: string | null }

/** "Repeats monthly" under a task's title; opens the series it came from. */
export function RecurringTaskBadge({ task, onOpen }: { task: SeriesLinked; onOpen: (seriesId: string) => void }) {
  if (!task.series_id) return null
  const seriesId = task.series_id
  return (
    <button
      type="button"
      onClick={() => onOpen(seriesId)}
      className="text-primary/80 hover:text-primary inline-flex w-fit items-center gap-1 text-xs font-medium"
    >
      <Repeat className="h-3 w-3 shrink-0" />
      {repeatBadgeLabel(task.series_frequency) ?? "Recurring"}
    </button>
  )
}

/** Table filter: recurring repeats versus one-off tasks. */
export function recurrenceFilter<T extends SeriesLinked>(): DataTableFilter<T> {
  return {
    key: "recurrence",
    label: "Recurrence",
    options: [
      { value: "recurring", label: "Recurring" },
      { value: "one_off", label: "One-off" },
    ],
    mode: "custom",
    filterFn: (row, vals) => {
      if (vals.length === 0) return true
      const recurring = Boolean(row.series_id)
      return (vals.includes("recurring") && recurring) || (vals.includes("one_off") && !recurring)
    },
  }
}
