"use client"

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { History } from "lucide-react"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { SectionHeading } from "@/components/ui/detail-list"
import {
  ASSET_ACTIVITY_STYLE,
  AssetTimeline,
  StatusTransition,
  activityMeta,
  heldFor,
} from "@/components/assets/asset-timeline"
import { apiJson } from "@/lib/api-client"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import {
  ASSET_ACTIVITY_LABELS,
  buildAssetActivities,
  type AssetActivity,
  type AssetActivityType,
  type AssetHistoryPayload,
} from "@/lib/assets/asset-activity"
import { logger } from "@/lib/logger"
import { QUERY_KEYS } from "@/lib/query-keys"
import { cn, formatName } from "@/lib/utils"
import { formatWATDateTime, toLocalISODate } from "@/lib/utils/date"

const log = logger("admin-assets-history-view")

type HistoryRow = AssetActivity & {
  unique_code: string
  asset_type_label: string
  asset_model: string
  year: string
}

/** What happened, in a few words, for the table and the export. */
function summary(row: HistoryRow): string {
  switch (row.type) {
    case "assignment":
      return `To ${row.user_name ?? "—"}`
    case "unassignment":
      return `From ${row.user_name ?? "—"}${row.details?.held_days ? ` after ${heldFor(row.details.held_days)}` : ""}`
    case "status_change":
      return `${formatName(row.details?.old_status ?? "") || "—"} → ${formatName(row.details?.status ?? "")}`
    case "issue_reported":
    case "issue_resolved":
      return row.description ?? ""
    case "archived":
      return row.description ?? "No reason given"
    case "created":
      return "Added to inventory"
    case "accepted":
    case "report_raised":
    case "report_closed":
      return row.description ? `${row.title}: ${row.description}` : row.title
  }
}

function EventBadge({ type }: { type: AssetActivityType }) {
  const style = ASSET_ACTIVITY_STYLE[type]
  const Icon = style.icon
  return (
    <Badge className={cn("gap-1", style.badge)}>
      <Icon className="h-3 w-3" />
      {ASSET_ACTIVITY_LABELS[type]}
    </Badge>
  )
}

async function exportHistoryToExcel(rows: HistoryRow[]) {
  if (rows.length === 0) {
    toast.error("Nothing to export")
    return
  }
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")
    const sheetRows = rows.map((row) => ({
      "When (WAT)": formatWATDateTime(row.timestamp),
      "Asset code": row.unique_code,
      "Asset type": row.asset_type_label,
      Model: row.asset_model,
      Event: ASSET_ACTIVITY_LABELS[row.type],
      Details: summary(row),
      "Assigned to / returned by":
        row.type === "assignment" || row.type === "unassignment" ? (row.user_name ?? "") : "",
      "Done by": row.performed_by_name ?? "",
      Notes: row.details?.notes ?? "",
    }))
    const sheet = XLSX.utils.json_to_sheet(sheetRows)
    sheet["!cols"] = Object.keys(sheetRows[0]).map((key) => ({
      wch: Math.min(Math.max(key.length, ...sheetRows.map((r) => String(r[key as keyof typeof r]).length)), 60),
    }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "Asset history")
    const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `asset-history-${toLocalISODate()}.xlsx`
    )
    toast.success(`Exported ${rows.length} event${rows.length === 1 ? "" : "s"}`)
  } catch (err) {
    log.error({ err: String(err) }, "Asset history export failed")
    toast.error("Failed to export")
  }
}

/** Lets the page's Export button export the history while this tab is open. */
export interface AssetHistoryViewHandle {
  exportToExcel: () => void
}

interface AssetHistoryViewProps {
  /** The assets the list shows; history is limited to these so both tabs agree. */
  assetIds: Set<string>
  /** Rows currently shown (after filters); the page uses it to enable Export. */
  onVisibleCountChange?: (count: number) => void
}

/**
 * Everything that has happened to every asset - added, assigned, returned, status changes, issues,
 * archived - newest first, for audit and export. The server already limits a department lead to
 * their assets; `assetIds` lines it up with the list on this page.
 */
export const AssetHistoryView = forwardRef<AssetHistoryViewHandle, AssetHistoryViewProps>(function AssetHistoryView(
  { assetIds, onVisibleCountChange },
  ref
) {
  const [processedRows, setProcessedRows] = useState<HistoryRow[]>([])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.adminAssetHistoryAll(),
    queryFn: () => apiJson<AssetHistoryPayload>("/api/admin/assets/history", { cache: "no-store" }),
    staleTime: 60_000,
    meta: { errorMessage: "Failed to load asset history" },
  })

  const rows = useMemo<HistoryRow[]>(() => {
    if (!data) return []
    const assetsById = new Map(data.assets.map((a) => [a.id, a]))
    return buildAssetActivities(data)
      .filter((activity) => assetIds.has(activity.asset_id))
      .map((activity) => {
        const asset = assetsById.get(activity.asset_id)
        return {
          ...activity,
          unique_code: asset?.unique_code ?? "—",
          asset_type_label: asset ? ASSET_TYPE_MAP[asset.asset_type]?.label || asset.asset_type : "—",
          asset_model: asset?.asset_model ?? "",
          year: activity.timestamp.slice(0, 4),
        }
      })
  }, [data, assetIds])

  const rowsByAsset = useMemo(() => {
    const map = new Map<string, HistoryRow[]>()
    rows.forEach((row) => map.set(row.asset_id, [...(map.get(row.asset_id) ?? []), row]))
    return map
  }, [rows])

  useEffect(() => {
    onVisibleCountChange?.(processedRows.length)
  }, [processedRows.length, onVisibleCountChange])

  useImperativeHandle(ref, () => ({ exportToExcel: () => void exportHistoryToExcel(processedRows) }), [processedRows])

  const filters = useMemo<DataTableFilter<HistoryRow>[]>(() => {
    const types = (Object.keys(ASSET_ACTIVITY_LABELS) as AssetActivityType[]).filter((type) =>
      rows.some((row) => row.type === type)
    )
    const assetTypes = Array.from(new Set(rows.map((row) => row.asset_type_label))).sort()
    const people = Array.from(
      new Set(rows.map((row) => row.performed_by_name).filter((name): name is string => Boolean(name)))
    ).sort()
    const years = Array.from(new Set(rows.map((row) => row.year)))
      .sort()
      .reverse()
    return [
      {
        key: "type",
        label: "Event",
        options: types.map((type) => ({ value: type, label: ASSET_ACTIVITY_LABELS[type] })),
        placeholder: "All events",
      },
      {
        key: "asset_type_label",
        label: "Asset type",
        options: assetTypes.map((label) => ({ value: label, label })),
        placeholder: "All types",
      },
      {
        key: "performed_by_name",
        label: "Done by",
        options: people.map((name) => ({ value: name, label: name })),
        placeholder: "Anyone",
      },
      {
        key: "year",
        label: "Year",
        options: years.map((year) => ({ value: year, label: year })),
        placeholder: "All years",
      },
    ]
  }, [rows])

  const columns = useMemo<DataTableColumn<HistoryRow>[]>(
    () => [
      {
        key: "timestamp",
        label: "When",
        sortable: true,
        accessor: (r) => r.timestamp,
        render: (r) => <span className="text-sm whitespace-nowrap">{formatWATDateTime(r.timestamp)}</span>,
      },
      {
        key: "unique_code",
        label: "Asset",
        sortable: true,
        accessor: (r) => r.unique_code,
        render: (r) => (
          <div>
            <div className="font-medium">{r.unique_code}</div>
            <div className="text-muted-foreground text-xs">
              {r.asset_type_label}
              {r.asset_model ? ` · ${r.asset_model}` : ""}
            </div>
          </div>
        ),
        resizable: true,
        initialWidth: 190,
      },
      {
        key: "type",
        label: "Event",
        sortable: true,
        accessor: (r) => ASSET_ACTIVITY_LABELS[r.type],
        render: (r) => <EventBadge type={r.type} />,
      },
      {
        key: "summary",
        label: "Details",
        accessor: (r) => summary(r),
        render: (r) =>
          r.type === "status_change" ? (
            <StatusTransition from={r.details?.old_status} to={r.details?.status} />
          ) : (
            <span className="line-clamp-2 text-sm">{summary(r)}</span>
          ),
        resizable: true,
        initialWidth: 280,
      },
      {
        key: "performed_by_name",
        label: "Done by",
        sortable: true,
        accessor: (r) => r.performed_by_name ?? "",
        render: (r) =>
          r.performed_by_name ? (
            <span className="font-medium">{r.performed_by_name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        hideOnMobile: true,
      },
    ],
    []
  )

  return (
    <DataTable<HistoryRow>
      data={rows}
      columns={columns}
      filters={filters}
      getRowId={(r) => r.id}
      onProcessedDataChange={setProcessedRows}
      searchPlaceholder="Search asset code, model, person or note…"
      searchFn={(r, q) =>
        [
          r.unique_code,
          r.asset_type_label,
          r.asset_model,
          r.title,
          r.user_name ?? "",
          r.performed_by_name ?? "",
          r.description ?? "",
          r.details?.notes ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      }
      pagination={{ pageSize: 50 }}
      isLoading={isLoading}
      error={error ? "Failed to load asset history" : null}
      onRetry={() => void refetch()}
      viewToggle
      contactsView
      stickyToolbar
      defaultViewMode={{ mobile: "contacts", desktop: "list" }}
      mobileRow={{
        title: (r) => `${r.unique_code} · ${r.title}`,
        subtitle: (r) => [formatWATDateTime(r.timestamp), activityMeta(r)].filter(Boolean).join(" · "),
        snippet: (r) => r.details?.notes || r.description || null,
        expandInline: true,
        trailing: (r) => <EventBadge type={r.type} />,
        detail: {
          title: (r) => `${r.unique_code} — ${r.title}`,
          subtitle: (r) => formatWATDateTime(r.timestamp),
          badges: (r) => <EventBadge type={r.type} />,
          fields: (r) => [
            { label: "Asset", value: `${r.asset_type_label}${r.asset_model ? ` · ${r.asset_model}` : ""}` },
            { label: "Event", value: ASSET_ACTIVITY_LABELS[r.type] },
            { label: "Details", value: summary(r) || "—", fullWidth: true },
            { label: "Done by", value: r.performed_by_name ?? "—" },
            ...(r.details?.notes ? [{ label: "Notes", value: r.details.notes, fullWidth: true }] : []),
          ],
        },
      }}
      cardRenderer={(r) => (
        <div className="bg-card space-y-2 rounded-xl border p-4 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{r.unique_code}</p>
              <p className="text-muted-foreground">
                {r.asset_type_label}
                {r.asset_model ? ` · ${r.asset_model}` : ""}
              </p>
            </div>
            <EventBadge type={r.type} />
          </div>
          <p className="text-foreground font-medium">{r.title}</p>
          <p className="text-muted-foreground">
            {formatWATDateTime(r.timestamp)}
            {r.performed_by_name ? ` · by ${r.performed_by_name}` : ""}
          </p>
        </div>
      )}
      emptyTitle="No asset history yet"
      emptyDescription="Assignments, returns, status changes and issues show here as they happen."
      emptyIcon={History}
      expandable={{
        render: (r) => {
          const note = r.details?.notes || r.description
          const assetEvents = rowsByAsset.get(r.asset_id) ?? []
          return (
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              <div className="space-y-3">
                <SectionHeading title="What happened" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatWATDateTime(r.timestamp)}
                    {activityMeta(r) ? ` • ${activityMeta(r)}` : ""}
                  </p>
                  {r.type === "status_change" ? (
                    <div className="pt-1">
                      <StatusTransition from={r.details?.old_status} to={r.details?.status} />
                    </div>
                  ) : null}
                </div>
                <section className="bg-muted/35 rounded-lg p-4" aria-label="Note">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    {r.type === "issue_reported" || r.type === "issue_resolved"
                      ? "Issue"
                      : r.type === "archived"
                        ? "Reason"
                        : "Note"}
                  </span>
                  <p
                    className={cn(
                      "mt-2 text-sm leading-6 whitespace-pre-wrap",
                      note ? "text-foreground" : "text-muted-foreground italic"
                    )}
                  >
                    {note || "No note was added."}
                  </p>
                </section>
              </div>
              <section className="space-y-3">
                <SectionHeading
                  title={`${r.unique_code} timeline`}
                  aside={`${assetEvents.length} event${assetEvents.length === 1 ? "" : "s"}`}
                />
                <AssetTimeline activities={assetEvents} limit={5} />
              </section>
            </div>
          )
        },
      }}
    />
  )
})
