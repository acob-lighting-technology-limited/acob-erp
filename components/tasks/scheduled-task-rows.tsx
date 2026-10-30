"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { StatusBadge } from "@/components/ui/patterns/status-badge"
import { formatWATDate } from "@/lib/utils/date"
import { listSeries, seriesListKey } from "@/lib/tasks/series-client"
import { scheduledSeriesTasks } from "@/lib/tasks/scheduled-rows"
import type { Task } from "@/types/task"

const NO_TASKS: Task[] = []

/**
 * The "Scheduled" rows to show alongside `tasks` (see lib/tasks/scheduled-rows).
 * Shares its query with the Recurring tab, so switching tabs costs no fetch.
 * A failed load just means no scheduled rows - it never blocks the task list.
 */
export function useScheduledSeriesRows(tasks: Task[], { mine = false }: { mine?: boolean } = {}): Task[] {
  const { data } = useQuery({
    queryKey: [...seriesListKey, mine ? "mine" : "all"],
    queryFn: () => listSeries(mine),
  })
  return useMemo(() => (data ? scheduledSeriesTasks(data, tasks) : NO_TASKS), [data, tasks])
}

/**
 * Status cell for a scheduled row: not started, and when its task will appear.
 * `compact` is the pill alone, for list rows and cards.
 */
export function ScheduledTaskBadge({ task, compact = false }: { task: Task; compact?: boolean }) {
  if (compact) return <StatusBadge status="scheduled" label="Scheduled" tone="info" className="whitespace-nowrap" />
  return (
    <div className="flex flex-col gap-0.5">
      <StatusBadge status="scheduled" label="Scheduled" tone="info" className="w-fit" />
      {task.task_start_date && (
        <span className="text-muted-foreground text-xs">Created {formatWATDate(task.task_start_date)}</span>
      )}
    </div>
  )
}
