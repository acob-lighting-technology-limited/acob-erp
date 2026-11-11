"use client"

import { cn } from "@/lib/utils"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueries } from "@tanstack/react-query"
import {
  Clock,
  Download,
  Eye,
  FastForward,
  FileCheck2,
  History,
  Inbox,
  PenLine,
  Plus,
  RefreshCw,
  Wallet,
  CalendarClock,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import {
  DataTable,
  DataTablePage,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableTab,
} from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { apiJson } from "@/lib/api-client"
import { toast } from "sonner"
import { formatWATDate } from "@/lib/utils/date"
import { exportRequisitionsToExcel, exportRequisitionsToPDF } from "@/lib/requisitions/export"
import {
  STATUS_LABELS,
  formatNaira,
  progressLabel,
  requisitionSummary,
  stagesOverriddenBy,
} from "@/lib/requisitions/format"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import { NairaAmount } from "@/components/requisitions/naira-amount"
import type {
  Requisition,
  RequisitionFormType,
  RequisitionStatus,
  RequisitionViewerActions,
} from "@/lib/requisitions/types"
import { NewRequisitionDialog } from "./new-requisition-dialog"
import { PaymentDialog } from "./payment-dialog"
import { SignDialog, type SignMode } from "./sign-dialog"
import { statusBadgeClass } from "./requisition-detail"
import { RequisitionPreviewSheet } from "./requisition-preview-sheet"
import { SCHEDULES_PATH } from "./requisition-paths"
import { UnpaidTag } from "./unpaid-tag"
import { RequisitionRowPanel } from "./requisition-row-panel"
import { ADMIN_REQUISITIONS_PATH, STAFF_REQUISITIONS_PATH } from "./requisition-paths"
import { QUERY_KEYS } from "@/lib/query-keys"

import { apiFetch } from "@/lib/api-client"
export type RequisitionsSurface = "staff" | "admin" | "dept"

type View = "mine" | "action" | "signed" | "payment" | "all" | "department"

interface ViewerFlags {
  is_admin: boolean
  is_payment_processor: boolean
  can_view_schedules?: boolean
}

export interface ExtraTab {
  tab: DataTableTab
  actions?: ReactNode
  content: ReactNode
}

const VIEW_TABS: Record<View, DataTableTab> = {
  mine: { key: "mine", label: "My requisitions", icon: FileCheck2 },
  action: { key: "action", label: "Needs my signature", icon: PenLine },
  signed: { key: "signed", label: "Signed by me", icon: History },
  payment: { key: "payment", label: "Awaiting payment", icon: Wallet },
  all: { key: "all", label: "All requisitions", icon: Inbox },
  department: { key: "department", label: "Department", icon: FileCheck2 },
}

function compactNaira(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
}

/**
 * The requisitions list for every surface. Staff see their own, what waits on
 * their signature and (for payment processors) what waits to be paid. Admins
 * see everything. A department console is locked to its department.
 */
export function RequisitionsListPage({
  surface,
  deptName,
  extraTabs = [],
  headerActions,
  detailBasePath,
}: {
  surface: RequisitionsSurface
  deptName?: string
  extraTabs?: ExtraTab[]
  /** Extra buttons in the page header, before Refresh. */
  headerActions?: ReactNode
  /** Where a requisition's full page lives. A department console passes its own. */
  detailBasePath?: string
}) {
  const router = useRouter()
  const [viewer, setViewer] = useState<ViewerFlags>({ is_admin: false, is_payment_processor: false })

  const views: View[] = useMemo(() => {
    if (surface === "dept") {
      // The Accounts lead pays from here, so a payment processor gets the payment queue too.
      const list: View[] = ["department", "action"]
      if (viewer.is_payment_processor) list.push("payment")
      return list
    }
    if (surface === "admin") return ["all", "action", "payment"]
    // Everything company-wide lives in the admin console; a person's page holds only what is theirs.
    const list: View[] = ["mine", "action", "signed"]
    if (viewer.is_payment_processor) list.push("payment")
    return list
  }, [surface, viewer])

  const [tab, setTab] = useState<string>(surface === "dept" ? "department" : surface === "admin" ? "all" : "mine")
  const [rows, setRows] = useState<Requisition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [signing, setSigning] = useState<{
    requisition: Requisition
    viewer: RequisitionViewerActions
    mode: SignMode
  } | null>(null)

  const [paying, setPaying] = useState<{ requisition: Requisition; viewer: RequisitionViewerActions } | null>(null)

  async function openPay(row: Requisition) {
    try {
      const json = await apiJson<{ data: Requisition; viewer: RequisitionViewerActions }>(`/api/requisitions/${row.id}`)
      setPaying({ requisition: json.data, viewer: json.viewer })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this requisition")
    }
  }

  // Opens the sign or reject dialog for a row. The detail record carries the
  // viewer's signing state, which the dialog needs.
  async function openSign(row: Requisition, mode: SignMode) {
    try {
      const json = await apiJson<{ data: Requisition; viewer: RequisitionViewerActions }>(`/api/requisitions/${row.id}`)
      setSigning({ requisition: json.data, viewer: json.viewer, mode })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this requisition")
    }
  }

  const extra = extraTabs.find((t) => t.tab.key === tab)
  const view = (extra ? null : (tab as View)) as View | null

  const fetchRows = useCallback(async () => {
    if (!view) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view })
      if (view === "department" && deptName) params.set("department", deptName)
      const res = await apiFetch(`/api/requisitions?${params}`)
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not load requisitions")
      setRows(json.data || [])
      if (json.viewer) setViewer(json.viewer)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requisitions")
    } finally {
      setIsLoading(false)
    }
  }, [view, deptName])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const basePath = detailBasePath || (surface === "admin" ? ADMIN_REQUISITIONS_PATH : STAFF_REQUISITIONS_PATH)
  const detailHref = (r: Requisition) => `${basePath}/${r.id}`
  const count = (status: RequisitionStatus) => rows.filter((r) => r.status === status).length
  const totalAmount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  const columns: DataTableColumn<Requisition>[] = [
    {
      key: "requisition_number",
      label: "Reference",
      sortable: true,
      accessor: (r) => r.requisition_number,
      render: (r) => (
        <Link
          href={detailHref(r)}
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey && e.button === 0) {
              e.preventDefault()
              setPreviewId(r.id)
            }
          }}
          className="flex flex-col hover:underline"
        >
          <span className="text-primary font-mono text-xs font-semibold whitespace-nowrap">{r.requisition_number}</span>
          <span className="text-muted-foreground text-xs whitespace-nowrap">{FORM_LABELS[r.form_type]}</span>
        </Link>
      ),
      initialWidth: 140,
    },
    {
      key: "requester",
      label: "Requested by",
      sortable: true,
      accessor: (r) => r.requester?.full_name || "",
      render: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium">{r.requester?.full_name || "—"}</span>
          <span className="text-muted-foreground truncate text-xs">{r.department}</span>
        </div>
      ),
      initialWidth: 170,
      hideOnMobile: surface === "staff" && tab === "mine",
    },
    {
      key: "summary",
      label: "For",
      accessor: (r) => requisitionSummary(r),
      render: (r) => <span className="line-clamp-2 text-xs">{requisitionSummary(r)}</span>,
      initialWidth: 260,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      accessor: (r) => Number(r.amount),
      align: "right",
      render: (r) => <NairaAmount value={r.amount} />,
      initialWidth: 150,
    },
    {
      key: "status",
      label: "Where it is",
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => (
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline" className={cn(statusBadgeClass(r.status), "w-fit text-xs")}>
            {STATUS_LABELS[r.status]}
          </Badge>
          {r.unpaid_at ? <UnpaidTag requisition={r} /> : null}
          {r.status === "pending" || r.status === "partly_paid" || r.status === "awaiting_approval" ? (
            <span className="text-muted-foreground truncate text-xs" title={progressLabel(r)}>
              {progressLabel(r)}
            </span>
          ) : null}
        </div>
      ),
      initialWidth: 200,
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      accessor: (r) => r.created_at,
      render: (r) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">{formatWATDate(r.created_at)}</span>
      ),
      initialWidth: 120,
      hideOnMobile: true,
    },
  ]

  const filters: DataTableFilter<Requisition>[] = [
    {
      key: "form_type",
      label: "Form",
      options: (Object.keys(FORM_LABELS) as RequisitionFormType[]).map((value) => ({
        value,
        label: FORM_LABELS[value],
      })),
    },
    {
      key: "status",
      label: "Status",
      options: (Object.keys(STATUS_LABELS) as RequisitionStatus[]).map((value) => ({
        value,
        label: STATUS_LABELS[value],
      })),
    },
  ]

  const title = surface === "admin" ? "Requisitions" : surface === "dept" ? `${deptName} requisitions` : "Requisitions"
  const description =
    surface === "admin"
      ? "Every Payment Request and Petty Cash voucher, what is waiting, and requisition settings."
      : surface === "dept"
        ? `Payment Requests and Petty Cash raised in ${deptName}.`
        : "Raise a Payment Request or Petty Cash, sign what is waiting on you, and follow your own."

  // Each tab shows how many requisitions it holds. The list endpoint returns the
  // rows for one view, so the count is the length of that view's list.
  const countQueries = useQueries({
    queries: views.map((v) => ({
      queryKey: QUERY_KEYS.requisitionTabCount(v, v === "department" ? deptName : null),
      queryFn: async () => {
        const params = new URLSearchParams({ view: v })
        if (v === "department" && deptName) params.set("department", deptName)
        const json = await apiJson<{ data?: unknown[] }>(`/api/requisitions?${params}`)
        return json.data?.length ?? 0
      },
      staleTime: 30_000,
    })),
  })
  const tabs = [
    ...views.map((v, i) => {
      const base = VIEW_TABS[v]
      const count = countQueries[i]?.data
      return count === undefined ? base : { ...base, label: `${base.label} (${count})` }
    }),
    ...extraTabs.map((t) => t.tab),
  ]

  return (
    <DataTablePage
      title={title}
      description={description}
      icon={FileCheck2}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      spacing="tight"
      actionsPlacement="inline-always"
      stats={
        view ? (
          <StatGrid>
            <StatCard
              variant="compact"
              title="In approval"
              value={count("pending")}
              icon={Clock}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-500"
            />
            <StatCard
              variant="compact"
              title="Awaiting payment"
              value={count("awaiting_payment") + count("scheduled") + count("partly_paid")}
              icon={Wallet}
              iconBgColor="bg-blue-500/10"
              iconColor="text-blue-500"
            />
            <StatCard
              variant="compact"
              title="Paid"
              value={count("paid") + count("awaiting_approval")}
              icon={CheckCircle2}
              iconBgColor="bg-emerald-500/10"
              iconColor="text-emerald-500"
            />
            <StatCard
              variant="compact"
              title="Total amount"
              value={compactNaira(totalAmount)}
              icon={FileCheck2}
              iconBgColor="bg-purple-500/10"
              iconColor="text-purple-500"
            />
          </StatGrid>
        ) : undefined
      }
      actions={
        extra ? (
          extra.actions
        ) : (
          <div className="flex items-center gap-2">
            {headerActions}
            {viewer.can_view_schedules ? (
              <Button asChild variant="outline" size="sm" aria-label="Payment schedules">
                <Link href={SCHEDULES_PATH}>
                  <CalendarClock className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Payment schedules</span>
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={fetchRows} aria-label="Refresh">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportOpen(true)}
              disabled={!rows.length}
              aria-label="Export"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} aria-label="New requisition">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New requisition</span>
            </Button>
          </div>
        )
      }
    >
      {extra ? (
        extra.content
      ) : (
        <DataTable<Requisition>
          data={rows}
          columns={columns}
          getRowId={(r) => r.id}
          searchPlaceholder="Search reference, person, project, purpose..."
          searchFn={(r, q) =>
            [
              r.requisition_number,
              r.previous_number,
              r.requester?.full_name,
              r.department,
              r.project_name,
              requisitionSummary(r),
            ]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          }
          filters={filters}
          expandable={{
            render: (r) => (
              <RequisitionRowPanel
                requisition={r}
                onOpen={() => setPreviewId(r.id)}
                onSign={r.sign_stage_id ? (mode) => void openSign(r, mode) : undefined}
                onPay={r.can_pay ? () => void openPay(r) : undefined}
              />
            ),
          }}
          rowActions={[
            {
              label: "Sign",
              icon: PenLine,
              onClick: (r) => void openSign(r, "sign"),
              hidden: (r) => !r.sign_stage_id || stagesOverriddenBy(r, r.sign_stage_id).length > 0,
            },
            {
              label: "Override",
              icon: FastForward,
              onClick: (r) => void openSign(r, "sign"),
              hidden: (r) => !r.sign_stage_id || stagesOverriddenBy(r, r.sign_stage_id).length === 0,
            },
            {
              label: "Reject",
              icon: XCircle,
              variant: "destructive",
              onClick: (r) => void openSign(r, "reject"),
              // A paid Payment Request is only signed off, never rejected.
              hidden: (r) => !r.sign_stage_id || r.status !== "pending",
            },
            {
              label: "Record payment",
              primary: true,
              icon: Wallet,
              onClick: (r) => void openPay(r),
              hidden: (r) => !r.can_pay,
            },
            { label: "View", icon: Eye, onClick: (r) => setPreviewId(r.id) },
          ]}
          inlineRowActions={tab === "payment"}
          isLoading={isLoading}
          error={error}
          onRetry={fetchRows}
          pagination={{ pageSize: 25 }}
          stickyToolbar
          viewToggle
          contactsView
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            title: (r) => requisitionSummary(r) || FORM_LABELS[r.form_type],
            subtitle: (r) =>
              `${r.requisition_number} · ${r.requester?.full_name || r.department} · ${formatNaira(r.amount)}`,
            trailing: (r) => (
              <Badge variant="outline" className={cn(statusBadgeClass(r.status), "text-xs")}>
                {STATUS_LABELS[r.status]}
              </Badge>
            ),
            // The detail opens in a slide-over preview drawer, keeping list position intact.
            onSelect: (r) => setPreviewId(r.id),
          }}
          emptyTitle={
            tab === "action"
              ? "Nothing waiting on you"
              : tab === "signed"
                ? "Nothing signed yet"
                : tab === "payment"
                  ? "Nothing to pay"
                  : "No requisitions"
          }
          emptyDescription={
            tab === "action"
              ? "Requisitions that need your signature will appear here."
              : tab === "signed"
                ? "Requisitions you sign, override, reject or pay appear here."
                : tab === "payment"
                  ? "Fully signed requisitions appear here until they are paid."
                  : "Raise a Payment Request or Petty Cash with New requisition."
          }
          emptyIcon={FileCheck2}
          skeletonRows={6}
          urlSync
          cardRenderer={(r) => (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPreviewId(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setPreviewId(r.id)
                }
              }}
              className="bg-card hover:border-primary/40 block h-full cursor-pointer space-y-3 rounded-xl border p-4 text-left shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground font-mono text-xs font-semibold">{r.requisition_number}</span>
                <NairaAmount value={r.amount} />
              </div>
              <p className="line-clamp-2 text-sm font-medium">{requisitionSummary(r)}</p>
              <p className="text-muted-foreground text-xs">
                {FORM_LABELS[r.form_type]} · {r.requester?.full_name || r.department}
              </p>
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <Badge variant="outline" className={cn(statusBadgeClass(r.status), "text-xs")}>
                  {STATUS_LABELS[r.status]}
                </Badge>
                <span className="text-muted-foreground truncate text-xs">{progressLabel(r)}</span>
              </div>
            </div>
          )}
        />
      )}

      {signing ? (
        <SignDialog
          open
          onOpenChange={(open) => !open && setSigning(null)}
          mode={signing.mode}
          requisition={signing.requisition}
          viewer={signing.viewer}
          onDone={() => {
            setSigning(null)
            void fetchRows()
          }}
        />
      ) : null}

      {paying ? (
        <PaymentDialog
          open
          onOpenChange={(open) => !open && setPaying(null)}
          requisition={paying.requisition}
          viewer={paying.viewer}
          onDone={() => {
            setPaying(null)
            void fetchRows()
          }}
        />
      ) : null}

      <NewRequisitionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={(r) => router.push(detailHref(r))}
      />
      <RequisitionPreviewSheet
        requisitionId={previewId}
        open={Boolean(previewId)}
        onOpenChange={(open) => !open && setPreviewId(null)}
        detailBasePath={basePath}
        onSign={(req, viewerActions, mode) => {
          setSigning({ requisition: req, viewer: viewerActions, mode })
        }}
        onPay={(req, viewerActions) => setPaying({ requisition: req, viewer: viewerActions })}
      />
      <ExportOptionsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        title="Export requisitions"
        options={[
          { id: "excel", label: "Excel", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
        ]}
        onSelect={(id) => {
          const label = `${title} — ${tabs.find((t) => t.key === tab)?.label ?? ""}`
          if (id === "excel") void exportRequisitionsToExcel(rows)
          else void exportRequisitionsToPDF(rows, label)
        }}
      />
    </DataTablePage>
  )
}
