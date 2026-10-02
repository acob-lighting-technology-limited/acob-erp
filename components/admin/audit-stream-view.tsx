"use client"

import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { StatusBadge } from "@/components/ui/patterns"
import type { StatusTone } from "@/lib/status-tones"
import { formatDateTime } from "@/lib/format"

export type AuditStreamRow = {
  id: string
  action: string | null
  operation: string | null
  entity_type: string | null
  entity_id: string | null
  user_id: string | null
  status?: string | null
  metadata: Record<string, unknown> | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export interface AuditStreamClass {
  value: string
  tone: StatusTone
  /** Show this class as a stat card (first three are kept on phones). */
  stat?: { icon: LucideIcon; iconBgColor: string; iconColor: string }
}

interface AuditStreamViewProps {
  rows: AuditStreamRow[]
  error: string | null
  title: string
  description: string
  icon: LucideIcon
  /** Column/filter label for the classification, e.g. "Severity" or "Role Tier". */
  classLabel: string
  classify: (row: AuditStreamRow) => string
  classes: AuditStreamClass[]
  /** Second line under the action — e.g. the row's status or operation. */
  detail: (row: AuditStreamRow) => string
  emptyTitle: string
  emptyDescription: string
}

/**
 * A classified stream of audit_logs rows (security events, role escalations…).
 * Each dev log page supplies how to classify a row; the table, filters, stats,
 * expandable JSON and mobile list are shared.
 */
export function AuditStreamView({
  rows,
  error,
  title,
  description,
  icon: Icon,
  classLabel,
  classify,
  classes,
  detail,
  emptyTitle,
  emptyDescription,
}: AuditStreamViewProps) {
  const toneByClass = useMemo(() => Object.fromEntries(classes.map((c) => [c.value, c.tone])), [classes])
  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const row of rows) {
      const key = classify(row)
      out[key] = (out[key] || 0) + 1
    }
    return out
  }, [rows, classify])

  const entityTypeOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.entity_type).filter((value): value is string => Boolean(value))))
        .sort()
        .map((value) => ({ value, label: value })),
    [rows]
  )

  const classBadge = (row: AuditStreamRow) => {
    const value = classify(row)
    return <StatusBadge status={value} label={value} tone={toneByClass[value] ?? "neutral"} />
  }

  const columns: DataTableColumn<AuditStreamRow>[] = [
    {
      key: "created_at",
      label: "Time",
      sortable: true,
      accessor: (row) => row.created_at,
      resizable: true,
      initialWidth: 220,
      hideOnMobile: true,
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "action",
      label: "Action",
      sortable: true,
      accessor: (row) => row.action || row.operation || "",
      render: (row) => (
        <div className="space-y-1">
          <p className="font-medium">{row.action || row.operation || "Unknown action"}</p>
          <p className="text-muted-foreground text-xs">{detail(row)}</p>
        </div>
      ),
    },
    {
      key: "entity_type",
      label: "Entity",
      sortable: true,
      accessor: (row) => row.entity_type || "",
      hideOnMobile: true,
      render: (row) => row.entity_type || "Unknown",
    },
    { key: "class", label: classLabel, accessor: (row) => classify(row), render: classBadge },
    {
      key: "user_id",
      label: "Actor ID",
      accessor: (row) => row.user_id || "",
      resizable: true,
      initialWidth: 220,
      hideOnMobile: true,
      render: (row) => <span className="font-mono text-xs">{row.user_id || "-"}</span>,
    },
  ]

  const filters: DataTableFilter<AuditStreamRow>[] = [
    { key: "class", label: classLabel, options: classes.map((c) => ({ value: c.value, label: c.value })) },
    { key: "entity_type", label: "Entity Type", options: entityTypeOptions },
  ]

  const statClasses = classes.filter((c) => c.stat)

  return (
    <DataTablePage
      title={title}
      description={description}
      icon={Icon}
      backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      stats={
        <StatGrid>
          {statClasses.map((c) => (
            <StatCard
              key={c.value}
              title={c.value}
              value={counts[c.value] || 0}
              icon={c.stat!.icon}
              iconBgColor={c.stat!.iconBgColor}
              iconColor={c.stat!.iconColor}
            />
          ))}
          <StatCard
            title="Total"
            value={rows.length}
            icon={Icon}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
        </StatGrid>
      }
    >
      <DataTable<AuditStreamRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 50 }}
        searchPlaceholder="Search action, entity, actor, or values..."
        searchFn={(row, query) =>
          [
            row.action,
            row.operation,
            row.status,
            row.entity_type,
            row.user_id,
            JSON.stringify(row.metadata || {}),
            JSON.stringify(row.new_values || {}),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
        }
        error={error}
        expandable={{
          render: (row) => (
            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  ["Metadata", row.metadata],
                  ["Old Values", row.old_values],
                  ["New Values", row.new_values],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
                  <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
                    {JSON.stringify(value || {}, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ),
        }}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (row) => row.action || row.operation || "Unknown action",
          subtitle: (row) => `${row.entity_type || "Event"} · ${formatDateTime(row.created_at)}`,
          trailing: classBadge,
        }}
        cardRenderer={(row) => (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.action || row.operation || "Unknown action"}</p>
                <p className="text-muted-foreground text-sm">{formatDateTime(row.created_at)}</p>
              </div>
              {classBadge(row)}
            </div>
            <div className="grid gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entity</span>
                <span>{row.entity_type || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Actor</span>
                <span className="font-mono text-xs">{row.user_id || "-"}</span>
              </div>
            </div>
          </div>
        )}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyIcon={Icon}
        skeletonRows={5}
        urlSync
      />
    </DataTablePage>
  )
}
