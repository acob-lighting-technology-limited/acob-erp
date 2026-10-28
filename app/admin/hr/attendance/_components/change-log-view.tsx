"use client"

import { forwardRef, useImperativeHandle, useMemo, useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
import { toast } from "sonner"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/hr/attendance-status"
import type { UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { getAttendanceMonthOptions, monthBounds, toLocalYearMonth } from "@/lib/hr/attendance-utils"
import { formatWATDate, formatWATDateTime, toLocalISODate } from "@/lib/utils/date"
import { logger } from "@/lib/logger"
import { CHANGE_LOG_CATEGORY_LABELS, type ChangeLogCategory, type ChangeLogRow } from "@/lib/hr/attendance-change-log"
import { apiJson } from "@/lib/api-client"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

const log = logger("admin-attendance-change-log-view")

const CATEGORY_CLASSES: Record<ChangeLogCategory, string> = {
  edits: "bg-info/15 text-info",
  bulk: "bg-info/15 text-info",
  appeals: "bg-info/15 text-info",
  leave: "bg-purple/15 text-purple",
  exemptions: "bg-purple/15 text-purple",
  out_of_station: "bg-info/15 text-info",
}

const APPEAL_OUTCOME_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  resolved: "Resolved",
}

function statusText(status: string | null): string {
  if (!status) return ""
  return ATTENDANCE_STATUS_LABELS[status as UnifiedAttendanceStatus] ?? status.replaceAll("_", " ")
}

/** "21 Sept 2026", or "21 Sept – 2 Oct 2026" when a change covered several days. */
function daySpan(row: ChangeLogRow): string {
  if (row.days.length === 1) return formatWATDate(row.day_from, { day: "numeric", month: "short", year: "numeric" })
  const sameYear = row.day_from.slice(0, 4) === row.day_to.slice(0, 4)
  const start = formatWATDate(
    row.day_from,
    sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }
  )
  return `${start} – ${formatWATDate(row.day_to, { day: "numeric", month: "short", year: "numeric" })}`
}

function dayCount(row: ChangeLogRow): string {
  return `${row.days.length} day${row.days.length === 1 ? "" : "s"}`
}

function fromText(row: ChangeLogRow): string {
  return row.from_mixed ? "Various" : statusText(row.from_status)
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return (
    <Badge className={ATTENDANCE_STATUS_COLORS[status as UnifiedAttendanceStatus] ?? "bg-gray-100 text-gray-800"}>
      {statusText(status)}
    </Badge>
  )
}

/**
 * The Change log reaches further back than attendance tracking (1 Jun 2026):
 * the exemptions added to it were created on 25 May 2026.
 */
const CHANGE_LOG_HISTORY_START = "2026-05-01"

async function exportChangeLogToExcel(rows: ChangeLogRow[], month: string) {
  if (rows.length === 0) {
    toast.error("Nothing to export")
    return
  }
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")
    const sheetRows = rows.map((row) => ({
      "Changed at (WAT)": formatWATDateTime(row.changed_at),
      "Changed by": row.actor_name,
      Employee: row.employee_name,
      Department: row.department,
      "First day": row.day_from,
      "Last day": row.day_to,
      "Number of days": row.days.length,
      "All days": row.days.join(", "),
      Change: row.change_label,
      Category: CHANGE_LOG_CATEGORY_LABELS[row.category],
      From: fromText(row),
      To: statusText(row.to_status),
      Comment: row.comment ?? "",
      Details: row.details ?? "",
      "Appeal requested": row.appeal ? statusText(row.appeal.requested_status) : "",
      "Appeal reason": row.appeal?.appeal_reason ?? "",
      "Appeal outcome": row.appeal ? (APPEAL_OUTCOME_LABELS[row.appeal.status] ?? row.appeal.status) : "",
      "Resolution note": row.appeal?.resolution_note ?? "",
    }))
    const sheet = XLSX.utils.json_to_sheet(sheetRows)
    sheet["!cols"] = Object.keys(sheetRows[0]).map((key) => ({
      wch: Math.min(Math.max(key.length, ...sheetRows.map((r) => String(r[key as keyof typeof r]).length)), 60),
    }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "Change log")
    const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `attendance-change-log-${month}.xlsx`
    )
    toast.success(`Exported ${rows.length} change${rows.length === 1 ? "" : "s"}`)
  } catch (err) {
    log.error({ err: String(err) }, "Change log export failed")
    toast.error("Failed to export")
  }
}

/** Lets the page's Export button export the change log while this tab is open. */
export interface ChangeLogViewHandle {
  exportToExcel: () => void
}

interface ChangeLogViewProps {
  lockedDepartment?: string
  /** Rows currently shown (after filters); the page uses it to enable Export. */
  onVisibleCountChange?: (count: number) => void
}

/**
 * Every change a person made to attendance - edits, bulk changes, out-of-station
 * directives, exemptions, leave and appeal decisions - read from the attendance
 * timeline, for audit, one month at a time. The page's Export button exports
 * what is currently filtered.
 */
export const ChangeLogView = forwardRef<ChangeLogViewHandle, ChangeLogViewProps>(function ChangeLogView(
  { lockedDepartment, onVisibleCountChange },
  ref
) {
  const today = toLocalISODate()
  const monthOptions = useMemo(() => getAttendanceMonthOptions(CHANGE_LOG_HISTORY_START), [])
  const [month, setMonth] = useState(toLocalYearMonth())
  const { start: from, end: monthEnd } = monthBounds(month)
  const to = monthEnd > today ? today : monthEnd
  const [processedRows, setProcessedRows] = useState<ChangeLogRow[]>([])

  const { data, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.attendanceChangeLog(from, to),
    enabled: Boolean(from && to && from <= to),
    queryFn: async () => {
      const params = new URLSearchParams({ from, to })
      const payload = await apiJson<{ data?: ChangeLogRow[]; truncated?: boolean }>(
        `/api/admin/hr/attendance/change-log?${params.toString()}`,
        { cache: "no-store" }
      )
      return { rows: payload.data ?? [], truncated: Boolean(payload.truncated) }
    },
    placeholderData: keepPreviousData,
    meta: { errorMessage: "Failed to load change log" },
  })
  const rows = useMemo(() => data?.rows ?? [], [data])
  const truncated = data?.truncated ?? false

  useEffect(() => {
    onVisibleCountChange?.(processedRows.length)
  }, [processedRows.length, onVisibleCountChange])

  useImperativeHandle(ref, () => ({ exportToExcel: () => void exportChangeLogToExcel(processedRows, month) }), [
    processedRows,
    month,
  ])

  const visibleRows = useMemo(
    () => (lockedDepartment ? rows.filter((row) => row.department === lockedDepartment) : rows),
    [rows, lockedDepartment]
  )

  const filters = useMemo<DataTableFilter<ChangeLogRow>[]>(() => {
    const categories = Array.from(new Set(visibleRows.map((row) => row.category)))
    const actors = Array.from(new Set(visibleRows.map((row) => row.actor_name))).sort()
    const departments = Array.from(new Set(visibleRows.map((row) => row.department).filter(Boolean))).sort()
    return [
      {
        // Picks which month is loaded rather than filtering rows (see onFilterChange).
        key: "month",
        label: "Month",
        options: monthOptions,
        placeholder: "Select month",
        multi: false,
        defaultValues: [month],
        mode: "custom",
        pinned: true,
        filterFn: () => true,
      },
      {
        key: "category",
        label: "Type",
        options: categories.map((category) => ({ value: category, label: CHANGE_LOG_CATEGORY_LABELS[category] })),
        placeholder: "All types",
      },
      {
        key: "actor_name",
        label: "Changed by",
        options: actors.map((actor) => ({ value: actor, label: actor })),
        placeholder: "Anyone",
      },
      {
        key: "department",
        label: "Department",
        options: departments.map((department) => ({ value: department, label: department })),
        placeholder: lockedDepartment || "All departments",
      },
    ]
  }, [visibleRows, lockedDepartment, monthOptions, month])

  const columns = useMemo<DataTableColumn<ChangeLogRow>[]>(
    () => [
      {
        key: "changed_at",
        label: "Changed",
        sortable: true,
        accessor: (r) => r.changed_at,
        render: (r) => <span className="text-sm whitespace-nowrap">{formatWATDateTime(r.changed_at)}</span>,
      },
      {
        key: "actor_name",
        label: "Changed by",
        sortable: true,
        accessor: (r) => r.actor_name,
        render: (r) => (
          <span className={r.actor_id ? "font-medium" : "text-muted-foreground italic"}>{r.actor_name}</span>
        ),
        resizable: true,
        initialWidth: 160,
      },
      {
        key: "employee_name",
        label: "Employee",
        sortable: true,
        accessor: (r) => r.employee_name,
        render: (r) => (
          <div>
            <div className="font-medium">{r.employee_name}</div>
            <div className="text-muted-foreground text-xs">{r.department}</div>
          </div>
        ),
        resizable: true,
        initialWidth: 180,
      },
      {
        key: "day",
        label: "Day",
        sortable: true,
        accessor: (r) => r.day_from,
        render: (r) => (
          <div className="whitespace-nowrap">
            <div>{daySpan(r)}</div>
            {r.days.length > 1 && <div className="text-muted-foreground text-xs">{dayCount(r)}</div>}
          </div>
        ),
      },
      {
        key: "change_label",
        label: "Change",
        accessor: (r) => r.change_label,
        render: (r) => (
          <div className="flex flex-col items-start gap-1">
            <Badge className={CATEGORY_CLASSES[r.category]}>{r.change_label}</Badge>
            {(r.from_status || r.from_mixed || r.to_status) && (
              <span className="flex items-center gap-1 text-xs">
                {r.from_mixed ? (
                  <Badge variant="outline" className="font-normal">
                    Various
                  </Badge>
                ) : (
                  <StatusBadge status={r.from_status} />
                )}
                <span className="text-muted-foreground">→</span>
                <StatusBadge status={r.to_status} />
              </span>
            )}
          </div>
        ),
      },
      {
        key: "comment",
        label: "Comment",
        accessor: (r) => r.comment ?? "",
        render: (r) => <span className="text-muted-foreground line-clamp-2 text-sm">{r.comment || "—"}</span>,
        hideOnMobile: true,
        resizable: true,
        initialWidth: 260,
      },
    ],
    []
  )

  return (
    <>
      {truncated && (
        <p className="text-warning border-warning/40 bg-warning/10 mb-3 rounded-md border p-2 text-xs">
          Showing the most recent 5,000 changes this month. Filter by type or person to export the rest in parts.
        </p>
      )}

      <DataTable<ChangeLogRow>
        data={visibleRows}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        onProcessedDataChange={setProcessedRows}
        onFilterChange={(selected) => {
          const selectedMonth = selected.month?.[0]
          if (selectedMonth && selectedMonth !== month) setMonth(selectedMonth)
        }}
        searchPlaceholder="Search employee, who changed it, or comment…"
        searchFn={(r, q) =>
          [r.employee_name, r.department, r.actor_name, r.change_label, r.comment ?? "", r.appeal?.appeal_reason ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)
        }
        pagination={{ pageSize: 50 }}
        isLoading={loading}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => `${r.employee_name} · ${r.change_label}`,
          subtitle: (r) =>
            `${daySpan(r)}${r.days.length > 1 ? ` (${dayCount(r)})` : ""} · by ${r.actor_name}${r.from_status || r.from_mixed || r.to_status ? ` · ${fromText(r) || "—"} → ${statusText(r.to_status) || "—"}` : ""}`,
          snippet: (r) => (r.comment ? `Comment: ${r.comment}` : null),
          expandInline: true,
          trailing: (r) => (
            <Badge className={CATEGORY_CLASSES[r.category]}>{CHANGE_LOG_CATEGORY_LABELS[r.category]}</Badge>
          ),
          detail: {
            title: (r) => `${r.employee_name} — ${r.change_label}`,
            subtitle: (r) => `${daySpan(r)} · by ${r.actor_name}`,
            badges: (r) => (
              <Badge className={CATEGORY_CLASSES[r.category]}>{CHANGE_LOG_CATEGORY_LABELS[r.category]}</Badge>
            ),
            fields: (r) => [
              { label: "Employee", value: r.employee_name },
              { label: "Department", value: r.department },
              { label: "Date Span", value: `${daySpan(r)} (${dayCount(r)})` },
              { label: "Changed By", value: r.actor_name },
              { label: "Timestamp", value: formatWATDateTime(r.changed_at) },
              ...(r.from_status || r.from_mixed || r.to_status
                ? [{ label: "Status Transition", value: `${fromText(r) || "—"} → ${statusText(r.to_status) || "—"}` }]
                : []),
              { label: "Comment", value: r.comment || "No comment was typed.", fullWidth: true },
              ...(r.details ? [{ label: "System Details", value: r.details, fullWidth: true }] : []),
            ],
          },
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-2 rounded-xl border p-4 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{r.employee_name}</p>
                <p className="text-muted-foreground">{r.department}</p>
              </div>
              <Badge className={CATEGORY_CLASSES[r.category]}>{r.change_label}</Badge>
            </div>
            <p className="text-muted-foreground">
              {daySpan(r)}
              {r.days.length > 1 ? ` (${dayCount(r)})` : ""} · by {r.actor_name} · {formatWATDateTime(r.changed_at)}
            </p>
            {r.comment && <p className="text-muted-foreground line-clamp-2 border-t pt-2">{r.comment}</p>}
          </div>
        )}
        emptyTitle="No changes in this range"
        emptyDescription="No one changed attendance in this month. Pick another month."
        emptyIcon={History}
        expandable={{
          render: (r) => (
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    Comment
                  </span>
                  <p className="whitespace-pre-wrap">{r.comment || "No comment was typed."}</p>
                </div>
                {r.details && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                      Recorded by the system
                    </span>
                    <p className="text-muted-foreground whitespace-pre-wrap">{r.details}</p>
                  </div>
                )}
              </div>
              {r.days.length > 1 && (
                <div className="space-y-1 md:col-span-2">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    Days changed · {r.days.length}
                  </span>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {r.days
                      .map((day) => formatWATDate(day, { weekday: "short", day: "numeric", month: "short" }))
                      .join(" · ")}
                  </p>
                </div>
              )}
              {r.appeal && (
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    Appeal · {APPEAL_OUTCOME_LABELS[r.appeal.status] ?? r.appeal.status}
                  </span>
                  <p>
                    Asked for <strong>{statusText(r.appeal.requested_status)}</strong>
                  </p>
                  {r.appeal.appeal_reason && (
                    <p className="text-muted-foreground whitespace-pre-wrap">Reason: {r.appeal.appeal_reason}</p>
                  )}
                  {r.appeal.resolution_note && (
                    <p className="text-muted-foreground whitespace-pre-wrap">Note: {r.appeal.resolution_note}</p>
                  )}
                </div>
              )}
            </div>
          ),
        }}
      />
    </>
  )
})
