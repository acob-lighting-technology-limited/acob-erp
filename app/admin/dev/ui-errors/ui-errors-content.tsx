"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import { toast } from "sonner"
import { groupErrors } from "@/lib/telemetry/group"
import { Badge } from "@/components/ui/badge"
import { formatWATDateTime } from "@/lib/utils/date"
import { Bug, AlertTriangle, ShieldAlert } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { DataTablePage, DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table"

export interface UiErrorRow {
  id: string
  created_at: string
  message: string
  source: string
  route: string
  user_name: string
  stack: string
  context: unknown
  resolved: boolean
  eventIds?: string[]
  occurrences?: number
}

interface UiErrorsContentProps {
  rows: UiErrorRow[]
  stats: {
    total: number
    last24h: number
    boundaries: number
    unresolved: number
  }
  error: unknown
  platformConfigured: boolean
  alertsEnabled: boolean
  collectorLastSuccess: string | null
}

export function UiErrorsContent({
  rows,
  stats,
  error,
  platformConfigured,
  alertsEnabled,
  collectorLastSuccess,
}: UiErrorsContentProps) {
  const router = useRouter()
  const groupedRows = useMemo(() => groupErrors(rows), [rows])
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, 60000)
    return () => clearInterval(timer)
  }, [router])
  const resolve = async (row: UiErrorRow) => {
    setBusy(row.id)
    try {
      const res = await apiFetch(`/api/admin/dev/errors/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !row.resolved, ids: row.eventIds || [row.id] }),
      })
      if (!res.ok) throw new Error("Unable to update error status")
      router.refresh()
    } catch {
      toast.error("Unable to update error status")
    } finally {
      setBusy(null)
    }
  }
  const toggleAlerts = async () => {
    setBusy("alerts")
    try {
      const res = await apiFetch("/api/admin/dev/errors/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !alertsEnabled }),
      })
      if (!res.ok) throw new Error("Unable to update alerts")
      toast.success(
        alertsEnabled ? "Error alerts disabled" : "Error alerts enabled; delivery requires the scheduled collector"
      )
      router.refresh()
    } catch {
      toast.error("Unable to update error alerts")
    } finally {
      setBusy(null)
    }
  }
  const columns: DataTableColumn<UiErrorRow>[] = useMemo(
    () => [
      { key: "occurrences", label: "Occurrences", sortable: true, accessor: (r) => r.occurrences || 1 },
      {
        key: "status",
        label: "Status",
        accessor: (r) => (r.resolved ? "resolved" : "open"),
        render: (r) => (
          <Badge variant={r.resolved ? "outline" : "destructive"}>{r.resolved ? "Resolved" : "Open"}</Badge>
        ),
      },
      {
        key: "time",
        label: "Time",
        sortable: true,
        accessor: (r) => r.created_at,
        hideOnMobile: true,
        render: (r) => <span className="text-xs whitespace-nowrap">{formatWATDateTime(r.created_at)}</span>,
      },
      {
        key: "source",
        label: "Source",
        sortable: true,
        accessor: (r) => r.source,
        render: (r) => (
          <Badge variant="outline" className="text-xs">
            {r.source}
          </Badge>
        ),
      },
      {
        key: "route",
        label: "Route",
        sortable: true,
        accessor: (r) => r.route,
        render: (r) => <span className="max-w-[220px] truncate font-mono text-xs">{r.route || "-"}</span>,
      },
      {
        key: "user",
        label: "User",
        sortable: true,
        accessor: (r) => r.user_name || "Anonymous",
      },
      {
        key: "message",
        label: "Message",
        sortable: true,
        resizable: true,
        initialWidth: 500,
        accessor: (r) => r.message,
        hideOnMobile: true,
        render: (r) => <span className="max-w-full truncate text-xs">{r.message}</span>,
      },
    ],
    []
  )

  const filters: DataTableFilter<UiErrorRow>[] = useMemo(() => {
    const sources = Array.from(new Set(rows.map((r) => r.source))).sort()
    const routes = Array.from(new Set(rows.map((r) => r.route).filter((x): x is string => !!x))).sort()

    return [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" },
        ],
      },
      {
        key: "source",
        label: "Source",
        options: sources.map((s) => ({ value: s, label: s })),
      },
      {
        key: "route",
        label: "Route",
        options: routes.map((r) => ({ value: r, label: r })),
      },
    ]
  }, [rows])

  return (
    <DataTablePage
      title="Error Monitor"
      description="Latest 500 browser, failed request, server and Supabase errors. Refreshes every minute while visible."
      icon={Bug}
      backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => {
              void toggleAlerts()
            }}
          >
            {alertsEnabled ? "Disable alerts" : "Notify me"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
      }
      stats={
        <StatGrid>
          <StatCard variant="compact" title="Open in Latest 500" value={stats.unresolved} icon={Bug} />
          <StatCard variant="compact" title="Last 24h" value={stats.last24h} icon={AlertTriangle} />
          <StatCard variant="compact" title="Boundary Catches" value={stats.boundaries} icon={ShieldAlert} />
        </StatGrid>
      }
    >
      {!platformConfigured && (
        <p role="status" className="mb-4 rounded-md border p-3 text-sm">
          Supabase platform collection needs a server management token and scheduled collector. App error capture is
          independent of this connection.
        </p>
      )}
      {platformConfigured && (
        <p role="status" className="text-muted-foreground mb-4 text-sm">
          {collectorLastSuccess
            ? `Platform collection last succeeded: ${formatWATDateTime(collectorLastSuccess)}`
            : "Platform token configured; awaiting the first successful collection."}
        </p>
      )}
      <DataTable<UiErrorRow>
        data={groupedRows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search message, route, source, user..."
        searchFn={(row, q) =>
          row.message.toLowerCase().includes(q) ||
          row.route.toLowerCase().includes(q) ||
          row.source.toLowerCase().includes(q) ||
          row.user_name.toLowerCase().includes(q)
        }
        filters={filters}
        error={error ? "Failed to load logs from backend storage" : null}
        pagination={{ pageSize: 50 }}
        onRetry={() => router.refresh()}
        rowActions={[
          {
            label: "Toggle resolved",
            onClick: (row) => {
              void resolve(row)
            },
          },
        ]}
        expandable={{
          render: (row) => (
            <div className="space-y-3 p-4 text-sm">
              <p className="break-all">
                <strong>Reference:</strong> {row.id}
              </p>
              <p>
                {row.occurrences || 1} occurrence(s) in the latest 500 events. Details below are from the latest
                occurrence.
              </p>
              <pre className="max-h-24 overflow-auto text-xs break-all whitespace-pre-wrap">
                {(row.eventIds || [row.id]).join("\n")}
              </pre>
              <p className="break-words whitespace-pre-wrap">{row.message}</p>
              <pre className="max-h-80 overflow-auto rounded border p-3 text-xs break-all whitespace-pre-wrap">
                {row.stack || "No stack trace available"}
              </pre>
              <pre className="max-h-60 overflow-auto text-xs break-all whitespace-pre-wrap">
                {JSON.stringify(row.context, null, 2)}
              </pre>
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => {
                  void resolve(row)
                }}
              >
                {row.resolved ? "Reopen" : "Mark resolved"}
              </Button>
            </div>
          ),
        }}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (r) => r.message,
          subtitle: (r) => `${r.source} · ${r.route || "-"} · ${formatWATDateTime(r.created_at)}`,
          trailing: (r) => (
            <Badge variant="outline" className="text-[10px]">
              {r.source}
            </Badge>
          ),
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="line-clamp-2 text-sm font-semibold">{r.message}</p>
                <p className="text-muted-foreground font-mono text-xs">{r.route || "-"}</p>
              </div>
              <Badge variant="outline">{r.source}</Badge>
            </div>
            <div className="text-muted-foreground flex justify-between border-t pt-2 text-[10px]">
              <span>{r.user_name || "Anonymous"}</span>
              <span>{formatWATDateTime(r.created_at)}</span>
            </div>
          </div>
        )}
      />
    </DataTablePage>
  )
}
