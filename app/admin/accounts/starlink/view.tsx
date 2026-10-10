"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { AlertTriangle, CreditCard, FolderKanban, Inbox, Pencil, Plus, Satellite, Wifi } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { apiFetch } from "@/lib/api-client"
import { isPaidStatus, type StarlinkMonthStatus } from "@/lib/starlink/billing-schedule"
import type { StarlinkKitListRow, StarlinkKitsData, UnmatchedStarlinkAccount } from "@/lib/starlink/kits"
import { cn } from "@/lib/utils"
import { KitDialog, type KitDialogTarget } from "./_components/kit-dialog"

export const STARLINK_KITS_QUERY_KEY = ["starlink-kits"] as const

const MONTH_LABELS: Record<StarlinkMonthStatus, { label: string; className: string }> = {
  confirmed: {
    label: "Paid · confirmed",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  autopay: {
    label: "Paid · autopay",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  failed: { label: "Payment failed", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  pending: {
    label: "Awaiting payment",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
}

const TABS: DataTableTab[] = [
  { key: "kits", label: "Kits", icon: Satellite },
  { key: "new", label: "New accounts", icon: Inbox },
]

async function fetchKits(): Promise<StarlinkKitsData> {
  const res = await apiFetch("/api/starlink/kits")
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Failed to load Starlink kits")
  return json.data as StarlinkKitsData
}

function formatMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount)
}

function formatDay(iso: string | null | undefined) {
  return iso ? format(parseISO(iso.slice(0, 10)), "d MMM yyyy") : "-"
}

/** Kit status for filtering: inactive, then this month's Starlink status. */
function kitStatus(kit: StarlinkKitListRow): string {
  if (!kit.is_active) return "inactive"
  return kit.latest_month?.status ?? "no_bills"
}

function MonthBadge({ kit }: { kit: StarlinkKitListRow }) {
  if (!kit.is_active) return <Badge variant="secondary">Inactive</Badge>
  if (!kit.latest_month) return <Badge variant="outline">No bills yet</Badge>
  const m = MONTH_LABELS[kit.latest_month.status]
  return <Badge className={cn("font-normal", m.className)}>{m.label}</Badge>
}

export function StarlinkKitsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") === "new" ? "new" : "kits"
  const [dialog, setDialog] = useState<KitDialogTarget | null>(null)

  const { data, isLoading, error, refetch } = useQuery({ queryKey: STARLINK_KITS_QUERY_KEY, queryFn: fetchKits })
  const kits = useMemo(() => data?.kits ?? [], [data])
  const unmatched = useMemo(() => data?.unmatched ?? [], [data])

  const stats = useMemo(() => {
    const active = kits.filter((k) => k.is_active)
    return {
      active: active.length,
      failed: active.filter((k) => k.latest_month?.status === "failed").length,
      paid: active.filter((k) => k.latest_month && isPaidStatus(k.latest_month.status)).length,
      noProject: active.filter((k) => !k.project).length,
    }
  }, [kits])

  const kitColumns = useMemo<DataTableColumn<StarlinkKitListRow>[]>(
    () => [
      {
        key: "site_name",
        label: "Kit",
        sortable: true,
        accessor: (k) => k.site_name,
        resizable: true,
        initialWidth: 200,
        render: (k) => (
          <div className="space-y-0.5">
            <p className="font-medium">{k.site_name}</p>
            <p className="text-muted-foreground font-mono text-xs">{k.serial_number ?? "-"}</p>
          </div>
        ),
      },
      {
        key: "project",
        label: "Project",
        sortable: true,
        accessor: (k) => k.project?.project_name ?? "No project",
        resizable: true,
        initialWidth: 260,
        render: (k) =>
          k.project ? (
            <span className="text-sm">{k.project.project_name}</span>
          ) : (
            <span className="text-muted-foreground text-sm">No project</span>
          ),
      },
      {
        key: "state",
        label: "State",
        sortable: true,
        hideOnMobile: true,
        accessor: (k) => k.state || "-",
      },
      {
        key: "amount",
        label: "Monthly",
        sortable: true,
        hideOnMobile: true,
        accessor: (k) => k.payment?.amount ?? 0,
        render: (k) => (k.payment ? formatMoney(k.payment.amount, k.payment.currency) : "-"),
      },
      {
        key: "next_due",
        label: "Next due",
        sortable: true,
        accessor: (k) => k.payment?.next_payment_due ?? "",
        render: (k) => formatDay(k.payment?.next_payment_due),
      },
      {
        key: "status",
        label: "This month",
        sortable: true,
        accessor: (k) => kitStatus(k),
        render: (k) => <MonthBadge kit={k} />,
      },
      {
        key: "email",
        label: "Login email",
        hideOnMobile: true,
        accessor: (k) => k.email ?? "-",
      },
    ],
    []
  )

  const kitFilters = useMemo<DataTableFilter<StarlinkKitListRow>[]>(
    () => [
      {
        key: "status",
        label: "This Month",
        options: [
          { value: "confirmed", label: "Paid · confirmed" },
          { value: "autopay", label: "Paid · autopay" },
          { value: "failed", label: "Payment failed" },
          { value: "pending", label: "Awaiting payment" },
          { value: "no_bills", label: "No bills yet" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      {
        key: "project",
        label: "Project",
        options: Array.from(new Set(kits.map((k) => k.project?.project_name ?? "No project")))
          .sort()
          .map((p) => ({ value: p, label: p })),
      },
      {
        key: "state",
        label: "State",
        options: Array.from(new Set(kits.map((k) => k.state || "-")))
          .sort()
          .map((s) => ({ value: s, label: s })),
      },
    ],
    [kits]
  )

  const unmatchedColumns = useMemo<DataTableColumn<UnmatchedStarlinkAccount>[]>(
    () => [
      {
        key: "account_number",
        label: "Starlink account",
        sortable: true,
        accessor: (a) => a.account_number,
        render: (a) => <span className="font-mono text-sm">{a.account_number}</span>,
      },
      {
        key: "recipient_email",
        label: "Sent to",
        sortable: true,
        accessor: (a) => a.recipient_email ?? "-",
      },
      {
        key: "amount",
        label: "Monthly",
        sortable: true,
        hideOnMobile: true,
        accessor: (a) => a.amount ?? 0,
        render: (a) => (a.amount != null ? formatMoney(a.amount, a.currency ?? "NGN") : "-"),
      },
      {
        key: "emails",
        label: "Emails",
        sortable: true,
        hideOnMobile: true,
        accessor: (a) => a.emails,
      },
      {
        key: "last_seen",
        label: "Last email",
        sortable: true,
        accessor: (a) => a.last_seen,
        render: (a) => formatDay(a.last_seen),
      },
    ],
    []
  )

  const unmatchedFilters = useMemo<DataTableFilter<UnmatchedStarlinkAccount>[]>(
    () => [
      {
        key: "recipient_email",
        label: "Sent To",
        options: Array.from(new Set(unmatched.map((a) => a.recipient_email ?? "-")))
          .sort()
          .map((e) => ({ value: e, label: e })),
      },
      {
        key: "seen",
        label: "Last Email",
        mode: "custom",
        options: [
          { value: "30", label: "Last 30 days" },
          { value: "older", label: "Older" },
        ],
        filterFn: (a, value) => {
          const values = Array.isArray(value) ? value : [value]
          const recent = Date.now() - Date.parse(a.last_seen) <= 30 * 24 * 60 * 60 * 1000
          return values.some((v) => (v === "30" ? recent : !recent))
        },
      },
    ],
    [unmatched]
  )

  const errorMessage = error instanceof Error ? error.message : null

  return (
    <DataTablePage
      title="Starlink Kits"
      description="Each Starlink kit, the project it serves and how its bills stand. Bills are read from the ict mailbox every hour."
      icon={Satellite}
      backLink={{ href: "/admin/accounts", label: "Back to Accounts" }}
      tabs={TABS.map((t) => (t.key === "new" ? { ...t, label: `New accounts (${unmatched.length})` } : t))}
      activeTab={tab}
      onTabChange={(next) => router.replace(next === "new" ? "?tab=new" : "?", { scroll: false })}
      actions={
        <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Kit</span>
          <span className="sm:hidden">Add</span>
        </Button>
      }
      stats={
        <StatGrid>
          <StatCard
            title="Payment failed"
            value={stats.failed}
            icon={AlertTriangle}
            iconBgColor={stats.failed > 0 ? "bg-red-500/10" : "bg-slate-500/10"}
            iconColor={stats.failed > 0 ? "text-red-500" : "text-slate-500"}
          />
          <StatCard
            title="New accounts"
            value={unmatched.length}
            icon={Inbox}
            iconBgColor={unmatched.length > 0 ? "bg-amber-500/10" : "bg-slate-500/10"}
            iconColor={unmatched.length > 0 ? "text-amber-500" : "text-slate-500"}
          />
          <StatCard
            title="Paid this month"
            value={`${stats.paid} of ${stats.active}`}
            icon={Wifi}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            title="No project"
            value={stats.noProject}
            icon={FolderKanban}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </StatGrid>
      }
    >
      {tab === "kits" ? (
        <DataTable<StarlinkKitListRow>
          data={kits}
          columns={kitColumns}
          filters={kitFilters}
          getRowId={(k) => k.id}
          searchPlaceholder="Search kit, account, project or email..."
          searchFn={(k, q) => {
            const query = q.toLowerCase()
            return [k.site_name, k.serial_number, k.kit_number, k.email, k.project?.project_name].some((v) =>
              (v ?? "").toLowerCase().includes(query)
            )
          }}
          isLoading={isLoading}
          error={errorMessage}
          onRetry={() => void refetch()}
          rowActions={[
            { label: "Edit kit", icon: Pencil, onClick: (k) => setDialog({ mode: "edit", kit: k }) },
            {
              label: "Open payment",
              icon: CreditCard,
              onClick: (k) => k.payment && router.push(`/admin/accounts/payments/${k.payment.id}`),
            },
          ]}
          viewToggle
          contactsView
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            title: (k) => k.site_name,
            subtitle: (k) =>
              `${k.project?.project_name ?? "No project"} · next due ${formatDay(k.payment?.next_payment_due)}`,
            trailing: (k) => <MonthBadge kit={k} />,
            onSelect: (k) => setDialog({ mode: "edit", kit: k }),
          }}
          cardRenderer={(k) => (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{k.site_name}</p>
                  <p className="text-muted-foreground truncate text-sm">{k.project?.project_name ?? "No project"}</p>
                </div>
                <MonthBadge kit={k} />
              </div>
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-mono text-xs">{k.serial_number ?? "-"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Next due</span>
                  <span>{formatDay(k.payment?.next_payment_due)}</span>
                </div>
              </div>
            </div>
          )}
          emptyTitle="No Starlink kits yet"
          emptyDescription="Add a kit, or add one from the New accounts tab once its bills reach the ict mailbox."
          emptyIcon={Satellite}
          urlSync
        />
      ) : (
        <DataTable<UnmatchedStarlinkAccount>
          data={unmatched}
          columns={unmatchedColumns}
          filters={unmatchedFilters}
          getRowId={(a) => a.account_number}
          searchPlaceholder="Search account or email..."
          searchFn={(a, q) => `${a.account_number} ${a.recipient_email ?? ""}`.toLowerCase().includes(q.toLowerCase())}
          isLoading={isLoading}
          error={errorMessage}
          onRetry={() => void refetch()}
          rowActions={[{ label: "Add as kit", icon: Plus, onClick: (a) => setDialog({ mode: "create", from: a }) }]}
          mobileRow={{
            title: (a) => a.account_number,
            subtitle: (a) => `${a.recipient_email ?? "Unknown login"} · ${a.emails} emails`,
            onSelect: (a) => setDialog({ mode: "create", from: a }),
          }}
          emptyTitle="No new Starlink accounts"
          emptyDescription="When a kit's Starlink email starts forwarding to ict and its account isn't a kit yet, it shows up here."
          emptyIcon={Inbox}
        />
      )}

      <KitDialog target={dialog} onOpenChange={(open) => !open && setDialog(null)} onSaved={() => void refetch()} />
    </DataTablePage>
  )
}
