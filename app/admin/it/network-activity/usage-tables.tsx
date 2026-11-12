"use client"

import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { Gauge } from "lucide-react"
import { formatBytes, formatNumber, formatPercent } from "@/lib/format"
import type { UsageDaySummary, UsageUserSummary } from "@/lib/security/network-usage-report"

const DOWNLOAD_HELP = "What the person's devices received from the internet (videos, pages, downloads, updates)."
const UPLOAD_HELP = "What the person's devices sent out (uploads, backups, video calls)."

function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

/** Logins with no @ (tv, bgi, security) belong to a place or a device, not one person. */
const isSharedLogin = (username: string) => !username.includes("@")

interface UsageUserRow extends UsageUserSummary {
  share: number
}

export function UsageByPersonTable({
  users,
  isLoading,
  error,
  onRetry,
}: {
  users: UsageUserSummary[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}) {
  const total = users.reduce((sum, u) => sum + u.totalBytes, 0)
  const rows: UsageUserRow[] = users.map((u) => ({ ...u, share: total > 0 ? u.totalBytes / total : 0 }))

  const columns: DataTableColumn<UsageUserRow>[] = [
    {
      key: "person",
      label: "Person",
      sortable: true,
      accessor: (r) => r.staffName ?? r.username,
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{r.staffName ?? r.username}</span>
            {isSharedLogin(r.username) && (
              <Badge variant="outline" className="text-[10px]">
                Shared login
              </Badge>
            )}
          </div>
          {r.staffName && <div className="text-muted-foreground truncate text-xs">{r.username}</div>}
        </div>
      ),
    },
    {
      key: "download",
      label: "Download",
      description: DOWNLOAD_HELP,
      sortable: true,
      align: "right",
      accessor: (r) => r.downloadBytes,
      render: (r) => formatBytes(r.downloadBytes),
    },
    {
      key: "upload",
      label: "Upload",
      description: UPLOAD_HELP,
      sortable: true,
      align: "right",
      accessor: (r) => r.uploadBytes,
      render: (r) => formatBytes(r.uploadBytes),
      hideOnMobile: true,
    },
    {
      key: "total",
      label: "Total",
      description: "Download plus upload. Starlink counts both against the monthly data.",
      sortable: true,
      align: "right",
      accessor: (r) => r.totalBytes,
      render: (r) => <span className="font-semibold">{formatBytes(r.totalBytes)}</span>,
    },
    {
      key: "share",
      label: "Share",
      description: "This login's part of everything counted in the range.",
      sortable: true,
      align: "right",
      accessor: (r) => r.share,
      render: (r) => formatPercent(r.share, { decimals: 1 }),
      hideOnMobile: true,
    },
    {
      key: "devices",
      label: "Devices",
      sortable: true,
      align: "right",
      accessor: (r) => r.devices,
      render: (r) => formatNumber(r.devices),
      hideOnMobile: true,
    },
    {
      key: "days",
      label: "Days seen",
      sortable: true,
      align: "right",
      accessor: (r) => r.daysActive,
      render: (r) => formatNumber(r.daysActive),
      hideOnMobile: true,
    },
  ]

  return (
    <DataTable<UsageUserRow>
      data={rows}
      columns={columns}
      getRowId={(r) => r.username}
      searchPlaceholder="Search a name or login…"
      searchFn={(r, q) => `${r.staffName ?? ""} ${r.username}`.toLowerCase().includes(q)}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      pagination={{ pageSize: 50 }}
      emptyIcon={Gauge}
      emptyTitle="No usage recorded for this range"
      emptyDescription="Usage is added every 5 minutes once the router is sending it. Try a longer range, or check back soon."
    />
  )
}

interface UsageDayRow extends UsageDaySummary {
  notCountedBytes: number
}

export function UsageByDayTable({
  days,
  isLoading,
  error,
  onRetry,
}: {
  days: UsageDaySummary[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}) {
  const rows: UsageDayRow[] = days.map((d) => ({
    ...d,
    notCountedBytes: d.officeDownloadBytes > 0 ? Math.max(0, d.officeDownloadBytes - d.downloadBytes) : 0,
  }))

  const columns: DataTableColumn<UsageDayRow>[] = [
    {
      key: "day",
      label: "Day",
      sortable: true,
      accessor: (r) => r.day,
      render: (r) => <span className="font-medium">{formatDay(r.day)}</span>,
    },
    {
      key: "download",
      label: "Download (logins)",
      description: "Added up across every login that signed in through the hotspot.",
      sortable: true,
      align: "right",
      accessor: (r) => r.downloadBytes,
      render: (r) => formatBytes(r.downloadBytes),
    },
    {
      key: "upload",
      label: "Upload (logins)",
      sortable: true,
      align: "right",
      accessor: (r) => r.uploadBytes,
      render: (r) => formatBytes(r.uploadBytes),
      hideOnMobile: true,
    },
    {
      key: "office",
      label: "Office line download",
      description:
        "What came in on the line to the Starlink. Compare with the Fieldbase portal, which counts the dish itself.",
      sortable: true,
      align: "right",
      accessor: (r) => r.officeDownloadBytes,
      render: (r) => (r.officeDownloadBytes > 0 ? formatBytes(r.officeDownloadBytes) : "—"),
    },
    {
      key: "uncounted",
      label: "Not in a login",
      description:
        "Office line download that no login accounts for: devices that skip the hotspot sign-in, the router's own traffic, or time before tracking was running.",
      sortable: true,
      align: "right",
      accessor: (r) => r.notCountedBytes,
      render: (r) => (r.officeDownloadBytes > 0 ? formatBytes(r.notCountedBytes) : "—"),
      hideOnMobile: true,
    },
  ]

  return (
    <DataTable<UsageDayRow>
      data={rows}
      columns={columns}
      getRowId={(r) => r.day}
      searchPlaceholder="Search a date, e.g. 2026-11-12…"
      searchFn={(r, q) => r.day.includes(q) || formatDay(r.day).toLowerCase().includes(q)}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      pagination={{ pageSize: 50 }}
      emptyIcon={Gauge}
      emptyTitle="No usage recorded for this range"
      emptyDescription="Daily totals appear here once the router has been sending usage."
    />
  )
}
