"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Building2,
  Hash,
  Package,
  User,
  Wrench,
  Layers,
  CalendarDays,
  FileText,
  Barcode,
  CheckCircle2,
  MessageSquareWarning,
} from "lucide-react"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import { formatName } from "@/lib/utils"
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"
import type { AssetAssignment } from "./page"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, RowAction } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { TONE_CLASSES } from "@/lib/ui/status-tones"
import {
  AssetAcceptanceBanner,
  ReportAssetProblemDialog,
  useAcceptAssignment,
} from "@/components/assets/staff-asset-actions"
import { ASSET_REPORT_KIND_LABELS, type AssetReportKind } from "@/lib/assets/asset-reports"

interface AssetsContentProps {
  initialAssignments: AssetAssignment[]
  initialError?: string | null
}

type AssetRow = AssetAssignment & {
  assetTypeLabel: string
  statusLabel: string
}

export function AssetsContent({ initialAssignments, initialError }: AssetsContentProps) {
  // Server data: after Accept or a report, router.refresh() sends new props.
  const assignments = initialAssignments
  const { accept, acceptingId } = useAcceptAssignment()
  const [reporting, setReporting] = useState<{ row: AssetRow; kind?: AssetReportKind } | null>(null)

  useEffect(() => {
    if (initialError) toast.error(initialError)
  }, [initialError])

  const rows = useMemo<AssetRow[]>(
    () =>
      assignments.map((assignment) => {
        return {
          ...assignment,
          assetTypeLabel:
            ASSET_TYPE_MAP[assignment.asset?.asset_type || ""]?.label || assignment.asset?.asset_type || "-",
          statusLabel: assignment.asset?.status || "available",
        }
      }),
    [assignments]
  )

  const statusClass = (status: string) => {
    if (status === "assigned") return TONE_CLASSES.success
    if (status === "maintenance") return TONE_CLASSES.warning
    if (status === "available") return TONE_CLASSES.info
    return TONE_CLASSES.neutral
  }

  const columns = useMemo<DataTableColumn<AssetRow>[]>(
    () => [
      {
        key: "asset_type",
        label: "Asset",
        sortable: true,
        accessor: (row) => row.assetTypeLabel,
        resizable: true,
        initialWidth: 220,
        render: (row) => (
          <div className="flex flex-col items-start gap-1">
            <span className="font-medium">{row.assetTypeLabel}</span>
            <AssetRowNotice row={row} />
          </div>
        ),
      },
      {
        key: "unique_code",
        label: "Unique Code",
        sortable: true,
        accessor: (row) => row.asset?.unique_code || "",
        render: (row) => <span className="font-mono text-sm">{row.asset?.unique_code || "-"}</span>,
      },
      {
        key: "asset_model",
        label: "Model",
        sortable: true,
        accessor: (row) => row.asset?.asset_model || "",
      },
      {
        key: "serial_number",
        label: "Serial",
        sortable: true,
        accessor: (row) => row.asset?.serial_number || "",
        hideOnMobile: true,
      },
      {
        key: "acquisition_year",
        label: "Year",
        sortable: true,
        accessor: (row) => row.asset?.acquisition_year || 0,
        hideOnMobile: true,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (row) => row.statusLabel,
        render: (row) => <Badge className={statusClass(row.statusLabel)}>{row.statusLabel}</Badge>,
      },
      {
        key: "assigned_at",
        label: "Assigned",
        sortable: true,
        accessor: (row) => row.assigned_at,
        render: (row) => formatWATDate(row.assigned_at, { day: "2-digit", month: "short", year: "numeric" }),
      },
    ],
    []
  )

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.statusLabel))).map((status) => ({
        value: status,
        label: status,
      })),
    [rows]
  )

  const assetTypeOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.assetTypeLabel))).map((assetType) => ({
        value: assetType,
        label: assetType,
      })),
    [rows]
  )

  const filters = useMemo<DataTableFilter<AssetRow>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: statusOptions,
      },
      {
        key: "asset_type",
        label: "Asset Type",
        options: assetTypeOptions,
      },
    ],
    [assetTypeOptions, statusOptions]
  )

  const activeCount = useMemo(
    () => rows.filter((r) => r.statusLabel === "assigned" || r.statusLabel === "active").length,
    [rows]
  )
  const maintenanceCount = useMemo(() => rows.filter((r) => r.statusLabel === "maintenance").length, [rows])
  const uniqueTypesCount = useMemo(() => new Set(rows.map((r) => r.assetTypeLabel)).size, [rows])

  const pendingAcceptance = rows.filter((row) => row.acceptance_status === "pending")

  const rowActions: RowAction<AssetRow>[] = [
    {
      label: "Accept",
      icon: CheckCircle2,
      primary: true,
      onClick: (row) => void accept(row),
      hidden: (row) =>
        !["pending", "auto_accepted"].includes(row.acceptance_status) || row.open_report_kind === "not_received",
    },
    {
      label: "Report a problem",
      icon: MessageSquareWarning,
      onClick: (row) => setReporting({ row }),
      hidden: (row) => Boolean(row.open_report_kind),
    },
  ]

  return (
    <DataTablePage
      title="Assets"
      description="View your currently assigned personal assets and equipment."
      icon={Package}
      spacing="tight"
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Total Personal Assets"
            value={rows.length}
            icon={Package}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Active"
            value={activeCount}
            icon={User}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          {/* Only when something is actually in the workshop — matches its badge. */}
          {maintenanceCount > 0 && (
            <StatCard
              variant="compact"
              title="In Maintenance"
              value={maintenanceCount}
              icon={Wrench}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-500"
            />
          )}
          <StatCard
            variant="compact"
            title="Asset Types"
            value={uniqueTypesCount}
            icon={Layers}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
            className={maintenanceCount > 0 ? "hidden sm:block" : undefined}
          />
        </StatGrid>
      }
    >
      <AssetAcceptanceBanner
        pending={pendingAcceptance}
        acceptingId={acceptingId}
        onAccept={(row) => void accept(row)}
        onNotReceived={(row) => {
          const match = rows.find((r) => r.id === row.id)
          if (match) setReporting({ row: match, kind: "not_received" })
        }}
      />
      <DataTable<AssetRow>
        rowActions={rowActions}
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 50 }}
        searchPlaceholder="Search asset name, code, model, or serial..."
        searchFn={(row, query) => {
          const q = query.toLowerCase()
          return (
            row.assetTypeLabel.toLowerCase().includes(q) ||
            String(row.asset?.unique_code || "")
              .toLowerCase()
              .includes(q) ||
            String(row.asset?.asset_model || "")
              .toLowerCase()
              .includes(q) ||
            String(row.asset?.serial_number || "")
              .toLowerCase()
              .includes(q) ||
            String(row.department || "")
              .toLowerCase()
              .includes(q) ||
            `${row.assigner?.first_name || ""} ${row.assigner?.last_name || ""}`.toLowerCase().includes(q)
          )
        }}
        emptyTitle="No assets found"
        emptyDescription={
          rows.length === 0 ? "You do not have any assets assigned yet." : "No assets match the current filters."
        }
        emptyIcon={Package}
        skeletonRows={6}
        stickyToolbar
        viewToggle
        contactsView
        // Seven columns of asset identifiers: a table where they fit, the row
        // list where they do not.
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (row) => row.assetTypeLabel,
          subtitle: (row) =>
            [row.asset?.unique_code, row.asset?.asset_model].filter(Boolean).join(" · ") || "No code recorded",
          trailing: (row) => <Badge className={`${statusClass(row.statusLabel)} text-xs`}>{row.statusLabel}</Badge>,
          detail: {
            title: (row) => row.assetTypeLabel,
            subtitle: (row) => (
              <span className="text-muted-foreground font-mono text-xs">{row.asset?.unique_code || "No code"}</span>
            ),
            badges: (row) => <Badge className={`${statusClass(row.statusLabel)} text-xs`}>{row.statusLabel}</Badge>,
            // Everything the removed expandable row carried. The serial and code
            // are the values you are asked for when reporting a fault, so they
            // are tap-to-copy rather than something to read out.
            fields: (row) => [
              { icon: Hash, label: "Unique code", value: row.asset?.unique_code, copyable: true },
              { icon: Package, label: "Model", value: row.asset?.asset_model },
              { icon: Barcode, label: "Serial number", value: row.asset?.serial_number, copyable: true },
              {
                icon: CalendarDays,
                label: "Acquisition year",
                value: row.asset?.acquisition_year ? String(row.asset.acquisition_year) : null,
                copyable: false,
              },
              {
                icon: CalendarDays,
                label: "Assigned",
                value: formatWATDateTime(row.assigned_at),
                copyable: false,
              },
              { icon: Building2, label: "Department", value: row.department },
              {
                icon: User,
                label: "Assigned by",
                value: row.assigner
                  ? `${formatName(row.assigner.first_name)} ${formatName(row.assigner.last_name)}`
                  : null,
              },
              { icon: FileText, label: "Notes", value: row.assignment_notes, copyable: true },
            ],
          },
        }}
        cardRenderer={(row) => (
          <div className="group bg-card text-card-foreground border-border/60 hover:border-primary/40 h-full space-y-3 rounded-xl border p-4 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.assetTypeLabel}</p>
                <p className="text-muted-foreground font-mono text-sm">{row.asset?.unique_code || "-"}</p>
              </div>
              <Badge className={statusClass(row.statusLabel)}>{row.statusLabel}</Badge>
            </div>
            <div className="grid gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Model</span>
                <span>{row.asset?.asset_model || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Serial</span>
                <span className="font-mono">{row.asset?.serial_number || "-"}</span>
              </div>
            </div>
          </div>
        )}
        urlSync
      />
      <ReportAssetProblemDialog
        key={reporting ? `${reporting.row.id}-${reporting.kind ?? ""}` : "closed"}
        assignment={reporting?.row ?? null}
        initialKind={reporting?.kind}
        onOpenChange={(open) => {
          if (!open) setReporting(null)
        }}
      />
    </DataTablePage>
  )
}

/** Under the asset name: what is waiting on this row, if anything. */
function AssetRowNotice({ row }: { row: AssetRow }) {
  if (row.open_report_kind) {
    const label = ASSET_REPORT_KIND_LABELS[row.open_report_kind as AssetReportKind]?.label ?? "Problem"
    return (
      <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs font-normal">
        Report sent: {label}
      </Badge>
    )
  }
  if (row.acceptance_status === "pending") {
    return (
      <Badge variant="outline" className="bg-info/15 text-info border-info/30 text-xs font-normal">
        Waiting for you to confirm
      </Badge>
    )
  }
  return null
}
