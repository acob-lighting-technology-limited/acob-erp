"use client"

import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/patterns/status-badge"
import { formatWATDate } from "@/lib/utils/date"
import { listSeries, seriesListKey, type SeriesListRow } from "@/lib/tasks/series-client"

const STATUS_LABELS: Record<SeriesListRow["status"], string> = { active: "Active", paused: "Paused", ended: "Ended" }

const COLUMNS: DataTableColumn<SeriesListRow>[] = [
  {
    key: "title",
    label: "Title",
    sortable: true,
    accessor: (r) => r.title,
    render: (r) => <span className="font-medium">{r.title}</span>,
  },
  {
    key: "assignee",
    label: "Assignee & Department",
    sortable: true,
    accessor: (r) => r.current_assignee_name ?? "",
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate">{r.current_assignee_name || "—"}</p>
        <p className="text-muted-foreground truncate text-xs">{r.department || "—"}</p>
      </div>
    ),
  },
  { key: "schedule", label: "Schedule", accessor: (r) => r.schedule_label },
  {
    key: "start_date",
    label: "Starts",
    sortable: true,
    hideOnMobile: true,
    accessor: (r) => r.start_date,
    render: (r) => formatWATDate(r.start_date),
  },
  {
    key: "next_due",
    label: "Next Due",
    sortable: true,
    accessor: (r) => r.next_due ?? "",
    render: (r) => (r.next_due && r.status === "active" ? formatWATDate(r.next_due) : "—"),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    accessor: (r) => r.status,
    render: (r) => (
      <StatusBadge
        status={r.status}
        label={STATUS_LABELS[r.status]}
        tone={r.status === "paused" ? "warning" : r.status === "ended" ? "neutral" : undefined}
      />
    ),
  },
]

const FILTERS: DataTableFilter<SeriesListRow>[] = [
  {
    key: "status",
    label: "Status",
    options: (Object.keys(STATUS_LABELS) as SeriesListRow["status"][]).map((value) => ({
      value,
      label: STATUS_LABELS[value],
    })),
  },
]

/**
 * Every recurring series the viewer can see, including ones whose first
 * repeat has not been created yet - a monthly series set up today has no task
 * until 5 working days before its first due date, so the task list alone
 * would hide it.
 */
export function RecurringSeriesTable({
  onOpenSeries,
  mine = false,
}: {
  onOpenSeries: (seriesId: string) => void
  /** Only the series the viewer holds now (staff /tasks), instead of every one they can see. */
  mine?: boolean
}) {
  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...seriesListKey, mine ? "mine" : "all"],
    queryFn: () => listSeries(mine),
  })

  return (
    <DataTable<SeriesListRow>
      data={data}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      pagination={{ pageSize: 50 }}
      isLoading={isLoading}
      onRetry={() => void refetch()}
      searchPlaceholder="Search recurring task title, assignee, or department..."
      searchFn={(r, q) =>
        `${r.title} ${r.current_assignee_name ?? ""} ${r.department ?? ""}`.toLowerCase().includes(q.toLowerCase())
      }
      filters={FILTERS}
      rowActions={[{ label: "Open Series", icon: Eye, onClick: (r) => onOpenSeries(r.id) }]}
      emptyTitle="No recurring tasks yet"
      emptyDescription='Create a task and choose how often it repeats under "Repeat".'
    />
  )
}
