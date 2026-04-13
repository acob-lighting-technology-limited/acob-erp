import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ShieldAlert, ShieldCheck, Siren } from "lucide-react"

type AuditLogRow = {
  id: string
  action: string | null
  operation: string | null
  entity_type: string | null
  entity_id: string | null
  user_id: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

function isSecurityEvent(log: AuditLogRow): boolean {
  const text =
    `${log.action || ""} ${log.operation || ""} ${log.entity_type || ""} ${log.status || ""} ` +
    `${JSON.stringify(log.metadata || {})} ${JSON.stringify(log.old_values || {})} ${JSON.stringify(log.new_values || {})}`.toLowerCase()
  const roleChangeSignal =
    text.includes("role") ||
    text.includes("super_admin") ||
    text.includes("developer") ||
    text.includes("is_admin") ||
    text.includes("admin_domains") ||
    text.includes("lead_departments")

  return (
    text.includes("auth") ||
    text.includes("permission_denied") ||
    text.includes("forbidden") ||
    text.includes("unauthorized") ||
    text.includes("security") ||
    text.includes("suspicious") ||
    text.includes("failed") ||
    text.includes("invalid") ||
    text.includes("blocked") ||
    text.includes("escalat") ||
    roleChangeSignal
  )
}

function getSeverity(row: AuditLogRow) {
  const text =
    `${row.action || ""} ${row.operation || ""} ${row.status || ""} ${JSON.stringify(row.metadata || {})}`.toLowerCase()
  if (text.includes("super_admin") || text.includes("developer") || text.includes("blocked")) return "Critical"
  if (text.includes("forbidden") || text.includes("unauthorized") || text.includes("failed")) return "High"
  if (text.includes("invalid") || text.includes("suspicious") || text.includes("security")) return "Medium"
  return "Low"
}

export const dynamic = "force-dynamic"

export default async function DevSecurityEventsPage() {
  await requireAdminSectionAccess("dev")

  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await dataClient
    .from("audit_logs")
    .select(
      "id, action, operation, entity_type, entity_id, user_id, status, metadata, old_values, new_values, created_at"
    )
    .returns<AuditLogRow[]>()
    .order("created_at", { ascending: false })
    .limit(1200)

  const rows = (data || []).filter(isSecurityEvent)

  const stats = {
    total: rows.length,
    critical: rows.filter((row) => getSeverity(row) === "Critical").length,
    high: rows.filter((row) => getSeverity(row) === "High").length,
    medium: rows.filter((row) => getSeverity(row) === "Medium").length,
  }

  const severityOptions = ["Critical", "High", "Medium", "Low"].map((value) => ({
    value,
    label: value,
  }))

  const entityTypeOptions = Array.from(
    new Set(rows.map((row) => row.entity_type).filter((value): value is string => Boolean(value)))
  )
    .sort()
    .map((value) => ({
      value,
      label: value,
    }))

  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      key: "created_at",
      label: "Time",
      sortable: true,
      accessor: (row) => row.created_at,
      resizable: true,
      initialWidth: 220,
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
    {
      key: "action",
      label: "Action",
      sortable: true,
      accessor: (row) => row.action || row.operation || "",
      render: (row) => (
        <div className="space-y-1">
          <p className="font-medium">{row.action || row.operation || "Unknown action"}</p>
          <p className="text-muted-foreground text-xs">{row.status || "No status"}</p>
        </div>
      ),
    },
    {
      key: "entity_type",
      label: "Entity",
      sortable: true,
      accessor: (row) => row.entity_type || "",
      render: (row) => row.entity_type || "Unknown",
    },
    {
      key: "severity",
      label: "Severity",
      accessor: (row) => getSeverity(row),
      render: (row) => (
        <Badge variant={getSeverity(row) === "Critical" ? "destructive" : "outline"}>{getSeverity(row)}</Badge>
      ),
    },
    {
      key: "user_id",
      label: "Actor ID",
      accessor: (row) => row.user_id || "",
      resizable: true,
      initialWidth: 220,
      render: (row) => <span className="font-mono text-xs">{row.user_id || "-"}</span>,
    },
  ]

  const filters: DataTableFilter<AuditLogRow>[] = [
    {
      key: "severity",
      label: "Severity",
      options: severityOptions,
    },
    {
      key: "entity_type",
      label: "Entity Type",
      options: entityTypeOptions,
    },
  ]

  return (
    <DataTablePage
      title="Security Events"
      description="Security-significant audit activity derived from authorization and risk signals."
      icon={ShieldAlert}
      backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      stats={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Events"
            value={stats.total}
            icon={ShieldAlert}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Critical"
            value={stats.critical}
            icon={Siren}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          <StatCard
            title="High"
            value={stats.high}
            icon={AlertTriangle}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            title="Medium"
            value={stats.medium}
            icon={ShieldCheck}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
        </div>
      }
    >
      <DataTable<AuditLogRow>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        searchPlaceholder="Search action, status, entity, actor, or metadata..."
        searchFn={(row, query) => {
          const normalizedQuery = query.toLowerCase()
          return (
            (row.action || "").toLowerCase().includes(normalizedQuery) ||
            (row.operation || "").toLowerCase().includes(normalizedQuery) ||
            (row.status || "").toLowerCase().includes(normalizedQuery) ||
            (row.entity_type || "").toLowerCase().includes(normalizedQuery) ||
            (row.user_id || "").toLowerCase().includes(normalizedQuery) ||
            JSON.stringify(row.metadata || {})
              .toLowerCase()
              .includes(normalizedQuery)
          )
        }}
        error={error?.message || null}
        expandable={{
          render: (row) => (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Metadata</p>
                <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(row.metadata || {}, null, 2)}
                </pre>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Old Values</p>
                <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(row.old_values || {}, null, 2)}
                </pre>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">New Values</p>
                <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(row.new_values || {}, null, 2)}
                </pre>
              </div>
            </div>
          ),
        }}
        viewToggle
        cardRenderer={(row) => (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.action || row.operation || "Unknown action"}</p>
                <p className="text-muted-foreground text-sm">{new Date(row.created_at).toLocaleString()}</p>
              </div>
              <Badge variant={getSeverity(row) === "Critical" ? "destructive" : "outline"}>{getSeverity(row)}</Badge>
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
        emptyTitle="No security events found"
        emptyDescription="No security-significant events were detected in the current log window."
        emptyIcon={ShieldAlert}
        skeletonRows={5}
        urlSync
      />
    </DataTablePage>
  )
}
