"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Database,
  HardDrive,
  Inbox,
  KeyRound,
  Link2,
  Lock,
  LockOpen,
  MailWarning,
  Plus,
  UserX,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { MailboxUsageBar } from "@/components/mailbox/mailbox-usage-bar"
import { apiFetch } from "@/lib/api-client"
import { MAILBOX_ALERT_PERCENT, formatBytes, mailboxLevel } from "@/lib/cpanel/quota"
import type { MailboxReport, MailboxReportRow, MissingMailboxRow } from "@/lib/cpanel/mailboxes"
import { CreateMailboxDialog } from "./_components/create-mailbox-dialog"
import { LinkDialog } from "./_components/link-dialog"
import { PasswordDialog } from "./_components/password-dialog"
import { QuotaDialog } from "./_components/quota-dialog"
import { SuspensionDialog, type SuspensionTarget } from "./_components/suspension-dialog"

export const MAILBOXES_QUERY_KEY = ["admin-mailboxes"] as const

type TabKey = "active" | "attention" | "suspended" | "missing"

const TAB_KEYS: TabKey[] = ["active", "attention", "suspended", "missing"]

const OWNER_LABELS: Record<MailboxReportRow["ownerKind"], string> = {
  staff: "Staff",
  inactive_staff: "Exited / suspended staff",
  project: "Project",
  none: "No staff record",
}

/** How full a mailbox is against its OWN quota — not how big it is. Sort the Used column for size. */
const LEVEL_LABELS = {
  ok: "Under 80% of quota",
  warn: "80–89% of quota (filling up)",
  alert: "90%+ of quota (almost full)",
} as const

async function fetchReport(): Promise<MailboxReport> {
  const res = await apiFetch("/api/admin/mailboxes", { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Failed to load mailboxes")
  return json.data as MailboxReport
}

function LoginBadge({ row }: { row: MailboxReportRow }) {
  if (row.inactiveOwnerCanLogIn) {
    return (
      <Badge className="bg-red-100 font-normal text-red-800 dark:bg-red-900/30 dark:text-red-400">
        Should be suspended
      </Badge>
    )
  }
  if (row.suspendedLogin && row.suspendedIncoming) return <Badge variant="secondary">Login + incoming suspended</Badge>
  if (row.suspendedLogin) return <Badge variant="secondary">Login suspended</Badge>
  return <Badge variant="outline">Active</Badge>
}

function OwnerCell({ row }: { row: MailboxReportRow }) {
  if (row.project) {
    return (
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">Project – {row.project.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {row.project.source === "starlink" ? "Starlink site kit" : "Project mailbox"}
        </p>
      </div>
    )
  }
  if (!row.owner) return <span className="text-muted-foreground text-sm">No staff record</span>
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="truncate text-sm font-medium">{row.owner.name}</p>
      <p className="text-muted-foreground truncate text-xs">
        {row.owner.department ?? "-"}
        {row.ownerKind === "inactive_staff" && ` · ${row.owner.employmentStatus}`}
      </p>
    </div>
  )
}

export function MailboxesPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabKey>(() => {
    const fromUrl = searchParams.get("tab") as TabKey | null
    return fromUrl && TAB_KEYS.includes(fromUrl) ? fromUrl : "active"
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<MailboxReportRow | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<MailboxReportRow | null>(null)
  const [quotaTarget, setQuotaTarget] = useState<MailboxReportRow | null>(null)
  const [suspensionTarget, setSuspensionTarget] = useState<SuspensionTarget | null>(null)

  const { data, isLoading, error, refetch } = useQuery({ queryKey: MAILBOXES_QUERY_KEY, queryFn: fetchReport })
  const mailboxes = useMemo(() => data?.mailboxes ?? [], [data])
  const missing = useMemo(() => data?.missing ?? [], [data])
  const attention = useMemo(() => mailboxes.filter((m) => m.needsAttention), [mailboxes])
  const suspended = useMemo(() => mailboxes.filter((m) => m.suspendedLogin || m.suspendedIncoming), [mailboxes])
  const active = useMemo(() => mailboxes.filter((m) => !m.suspendedLogin && !m.suspendedIncoming), [mailboxes])

  const stats = useMemo(() => {
    const account = data?.account
    const inodePercent =
      account?.inodeLimit != null ? Math.round((account.inodesUsed / account.inodeLimit) * 100) : null
    return {
      nearlyFull: mailboxes.filter((m) => (m.usedPercent ?? 0) >= MAILBOX_ALERT_PERCENT).length,
      inactiveActive: mailboxes.filter((m) => m.inactiveOwnerCanLogIn).length,
      inodes:
        account == null
          ? "-"
          : account.inodeLimit != null
            ? `${account.inodesUsed.toLocaleString()} / ${account.inodeLimit.toLocaleString()}`
            : account.inodesUsed.toLocaleString(),
      inodePercent,
    }
  }, [data, mailboxes])

  const mailboxColumns = useMemo<DataTableColumn<MailboxReportRow>[]>(
    () => [
      {
        key: "email",
        label: "Mailbox",
        sortable: true,
        accessor: (m) => m.email,
        resizable: true,
        initialWidth: 280,
        render: (m) => <span className="font-medium break-all">{m.email}</span>,
      },
      {
        key: "owner",
        label: "Owner",
        sortable: true,
        accessor: (m) => m.owner?.name ?? (m.project ? `Project – ${m.project.name}` : ""),
        resizable: true,
        initialWidth: 220,
        render: (m) => <OwnerCell row={m} />,
      },
      {
        key: "usage",
        label: "Fullness",
        sortable: true,
        accessor: (m) => m.usedPercent ?? 0,
        initialWidth: 200,
        render: (m) => (
          <MailboxUsageBar
            usedBytes={m.usedBytes}
            quotaBytes={m.quotaBytes}
            usedPercent={m.usedPercent}
            className="w-44"
          />
        ),
      },
      {
        key: "used",
        label: "Used",
        sortable: true,
        hideOnMobile: true,
        accessor: (m) => m.usedBytes,
        render: (m) => <span className="text-sm tabular-nums">{formatBytes(m.usedBytes)}</span>,
      },
      {
        key: "login",
        label: "Login",
        sortable: true,
        hideOnMobile: true,
        accessor: (m) => (m.inactiveOwnerCanLogIn ? "should_suspend" : m.suspendedLogin ? "suspended" : "active"),
        render: (m) => <LoginBadge row={m} />,
      },
      {
        key: "domain",
        label: "Domain",
        sortable: true,
        hideOnMobile: true,
        accessor: (m) => m.domain,
      },
    ],
    []
  )

  const mailboxFilters = useMemo<DataTableFilter<MailboxReportRow>[]>(
    () => [
      {
        key: "ownerKind",
        label: "Owner",
        mode: "custom",
        options: (Object.keys(OWNER_LABELS) as MailboxReportRow["ownerKind"][]).map((k) => ({
          value: k,
          label: OWNER_LABELS[k],
        })),
        filterFn: (m, value) => (Array.isArray(value) ? value : [value]).includes(m.ownerKind),
      },
      {
        key: "level",
        label: "Fullness",
        mode: "custom",
        options: (Object.keys(LEVEL_LABELS) as Array<keyof typeof LEVEL_LABELS>).map((k) => ({
          value: k,
          label: LEVEL_LABELS[k],
        })),
        filterFn: (m, value) => (Array.isArray(value) ? value : [value]).includes(mailboxLevel(m.usedPercent)),
      },
      {
        key: "login",
        label: "Login",
        options: [
          { value: "active", label: "Active" },
          { value: "suspended", label: "Suspended" },
          { value: "should_suspend", label: "Should be suspended" },
        ],
      },
      {
        key: "domain",
        label: "Domain",
        options: Array.from(new Set(mailboxes.map((m) => m.domain)))
          .sort()
          .map((d) => ({ value: d, label: d })),
      },
    ],
    [mailboxes]
  )

  const missingColumns = useMemo<DataTableColumn<MissingMailboxRow>[]>(
    () => [
      {
        key: "name",
        label: "Employee",
        sortable: true,
        accessor: (r) => r.name,
        render: (r) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: "email",
        label: "Company email on profile",
        sortable: true,
        accessor: (r) => r.email,
        render: (r) => <span className="break-all">{r.email}</span>,
      },
      { key: "department", label: "Department", sortable: true, accessor: (r) => r.department ?? "-" },
      {
        key: "employmentStatus",
        label: "Status",
        sortable: true,
        hideOnMobile: true,
        accessor: (r) => r.employmentStatus,
      },
      {
        key: "provisioning",
        label: "Matrix attempt",
        sortable: true,
        accessor: (r) => (r.provisioningError ? "failed" : "none"),
        render: (r) =>
          r.provisioningError ? (
            <Badge
              className="bg-red-100 font-normal text-red-800 dark:bg-red-900/30 dark:text-red-400"
              title={r.provisioningError}
            >
              Failed: {r.provisioningError}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          ),
      },
    ],
    []
  )

  const missingFilters = useMemo<DataTableFilter<MissingMailboxRow>[]>(
    () => [
      {
        key: "department",
        label: "Department",
        options: Array.from(new Set(missing.map((r) => r.department ?? "-")))
          .sort()
          .map((d) => ({ value: d, label: d })),
      },
      {
        key: "provisioning",
        label: "Matrix Attempt",
        options: [
          { value: "failed", label: "Failed" },
          { value: "none", label: "Not attempted" },
        ],
      },
      {
        key: "employmentStatus",
        label: "Status",
        options: Array.from(new Set(missing.map((r) => r.employmentStatus)))
          .sort()
          .map((s) => ({ value: s, label: s })),
      },
    ],
    [missing]
  )

  const tabs: DataTableTab[] = [
    { key: "active", label: `Active (${active.length})`, icon: Inbox },
    { key: "attention", label: `Needs attention (${attention.length})`, icon: AlertTriangle },
    { key: "suspended", label: `Suspended (${suspended.length})`, icon: Lock },
    { key: "missing", label: `No mailbox (${missing.length})`, icon: UserX },
  ]

  const errorMessage = error instanceof Error ? error.message : null
  const mailboxRows = tab === "attention" ? attention : tab === "suspended" ? suspended : active

  return (
    <DataTablePage
      title="Mailboxes"
      description="Staff and project mailboxes on cPanel, matched against employee and project records. Usage is read live from cPanel."
      icon={HardDrive}
      backLink={{ href: "/admin/settings", label: "Back to Settings" }}
      actions={
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create Mailbox
        </Button>
      }
      tabs={tabs}
      activeTab={tab}
      onTabChange={(next) => setTab(next as TabKey)}
      stats={
        <StatGrid>
          <StatCard
            title="90% full or more"
            value={stats.nearlyFull}
            icon={MailWarning}
            iconBgColor={stats.nearlyFull > 0 ? "bg-red-500/10" : "bg-slate-500/10"}
            iconColor={stats.nearlyFull > 0 ? "text-red-500" : "text-slate-500"}
          />
          <StatCard
            title={
              stats.inodePercent != null ? `Account files (inodes) · ${stats.inodePercent}%` : "Account files (inodes)"
            }
            value={stats.inodes}
            icon={Database}
            iconBgColor={(stats.inodePercent ?? 0) >= 80 ? "bg-amber-500/10" : "bg-blue-500/10"}
            iconColor={(stats.inodePercent ?? 0) >= 80 ? "text-amber-500" : "text-blue-500"}
          />
          <StatCard
            title="Left staff, still active"
            value={stats.inactiveActive}
            icon={UserX}
            iconBgColor={stats.inactiveActive > 0 ? "bg-amber-500/10" : "bg-slate-500/10"}
            iconColor={stats.inactiveActive > 0 ? "text-amber-500" : "text-slate-500"}
          />
          <StatCard
            title="Staff with no mailbox"
            value={missing.length}
            icon={Inbox}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </StatGrid>
      }
    >
      {tab === "missing" ? (
        <DataTable<MissingMailboxRow>
          data={missing}
          columns={missingColumns}
          filters={missingFilters}
          getRowId={(r) => r.profileId}
          searchPlaceholder="Search name or email..."
          searchFn={(r, q) => `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase())}
          isLoading={isLoading}
          error={errorMessage}
          onRetry={() => void refetch()}
          mobileRow={{
            title: (r) => r.name,
            subtitle: (r) => r.email,
          }}
          emptyTitle="Every employee has a mailbox"
          emptyDescription={`Employees whose company email is on @${data?.staffDomain ?? "the staff domain"} but has no mailbox on cPanel show up here.`}
          emptyIcon={UserX}
        />
      ) : (
        <DataTable<MailboxReportRow>
          key={tab}
          data={mailboxRows}
          columns={mailboxColumns}
          filters={mailboxFilters}
          getRowId={(m) => m.email}
          searchPlaceholder="Search mailbox or owner..."
          searchFn={(m, q) =>
            `${m.email} ${m.owner?.name ?? ""} ${m.project?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())
          }
          isLoading={isLoading}
          error={errorMessage}
          onRetry={() => void refetch()}
          rowActions={[
            { label: "Change quota", icon: HardDrive, onClick: (m) => setQuotaTarget(m) },
            { label: "Reset password", icon: KeyRound, onClick: (m) => setPasswordTarget(m) },
            { label: "Link mailbox", icon: Link2, onClick: (m) => setLinkTarget(m) },
            {
              label: "Suspend mailbox",
              icon: Lock,
              variant: "destructive",
              hidden: (m) => m.suspendedLogin,
              onClick: (m) => setSuspensionTarget({ mailbox: m, action: "suspend" }),
            },
            {
              label: "Restore mailbox",
              icon: LockOpen,
              hidden: (m) => !m.suspendedLogin && !m.suspendedIncoming,
              onClick: (m) => setSuspensionTarget({ mailbox: m, action: "restore" }),
            },
          ]}
          mobileRow={{
            title: (m) => m.email,
            subtitle: (m) => m.owner?.name ?? (m.project ? `Project – ${m.project.name}` : "No staff record"),
            trailing: (m) => (
              <MailboxUsageBar
                usedBytes={m.usedBytes}
                quotaBytes={m.quotaBytes}
                usedPercent={m.usedPercent}
                className="w-28"
              />
            ),
            onSelect: (m) => setQuotaTarget(m),
          }}
          pagination={{ pageSize: 50 }}
          emptyTitle={
            tab === "attention"
              ? "Nothing needs attention"
              : tab === "suspended"
                ? "No suspended mailboxes"
                : "No active mailboxes"
          }
          emptyDescription={
            tab === "attention"
              ? "Mailboxes 90% full or more, and mailboxes of exited or suspended staff that can still log in, show up here."
              : tab === "suspended"
                ? "Mailboxes whose login or incoming mail is suspended show up here."
                : "Every mailbox is suspended — see the Suspended tab."
          }
          emptyIcon={Inbox}
        />
      )}

      <CreateMailboxDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void refetch()} />
      <LinkDialog
        mailbox={linkTarget}
        onOpenChange={(open) => !open && setLinkTarget(null)}
        onLinked={() => void refetch()}
      />
      <PasswordDialog mailbox={passwordTarget} onOpenChange={(open) => !open && setPasswordTarget(null)} />
      <QuotaDialog
        mailbox={quotaTarget}
        onOpenChange={(open) => !open && setQuotaTarget(null)}
        onSaved={() => void refetch()}
      />
      <SuspensionDialog
        target={suspensionTarget}
        onOpenChange={(open) => !open && setSuspensionTarget(null)}
        onSaved={() => void refetch()}
      />
    </DataTablePage>
  )
}
