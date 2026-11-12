"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Archive,
  CalendarDays,
  Download,
  ExternalLink,
  Gauge,
  HardDrive,
  ShieldCheck,
  Upload,
  Wifi,
} from "lucide-react"
import { toast } from "sonner"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatBytes, formatNumber } from "@/lib/format"
import { toLocalISODate } from "@/lib/utils/date"
import { shiftIsoDay, type UsageReport } from "@/lib/security/network-usage-report"
import { UsageByDayTable, UsageByPersonTable } from "./usage-tables"

import { apiFetch } from "@/lib/api-client"
interface ArchivedDay {
  date: string
  files: number
  bytes: number
  webUrl: string
}

interface ArchiveResponse {
  days: ArchivedDay[]
  retentionMonths: number
}

interface UsageResponse extends UsageReport {
  range: { from: string; to: string }
  trackingSince: string | null
}

type TabKey = "logs" | "usage" | "days"

const TABS: DataTableTab[] = [
  { key: "logs", label: "Activity logs", icon: Archive },
  { key: "usage", label: "Data usage", icon: Gauge },
  { key: "days", label: "Daily totals", icon: CalendarDays },
]

const RANGES = [
  { key: "today", label: "Today", daysBack: 0, lastDaysBack: 0 },
  { key: "yesterday", label: "Yesterday", daysBack: 1, lastDaysBack: 1 },
  { key: "7d", label: "Last 7 days", daysBack: 6, lastDaysBack: 0 },
  { key: "30d", label: "Last 30 days", daysBack: 29, lastDaysBack: 0 },
] as const
type RangeKey = (typeof RANGES)[number]["key"]

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

async function fetchArchive(): Promise<ArchiveResponse> {
  const res = await apiFetch("/api/admin/security/network-activity", { cache: "no-store" })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? "Failed to load the network log archive")
  return body.data as ArchiveResponse
}

async function fetchUsage(range: { from: string; to: string }): Promise<UsageResponse> {
  const res = await apiFetch(`/api/admin/security/network-activity/usage?from=${range.from}&to=${range.to}`, {
    cache: "no-store",
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? "Failed to load data usage")
  return body.data as UsageResponse
}

async function downloadDay(date: string) {
  const res = await apiFetch(`/api/admin/security/network-activity/download?date=${date}`, { cache: "no-store" })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "Download failed")
  }
  const url = URL.createObjectURL(await res.blob())
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `network-logs-${date}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function AdminSecurityNetworkActivityPage({ backLinkHref }: { backLinkHref?: string } = {}) {
  const [tab, setTab] = useState<TabKey>("logs")
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d")
  const usageActive = tab !== "logs"

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.adminSecurityNetworkActivity(),
    queryFn: fetchArchive,
  })
  const [downloading, setDownloading] = useState<string | null>(null)

  const range = useMemo(() => {
    const today = toLocalISODate()
    const option = RANGES.find((r) => r.key === rangeKey) ?? RANGES[2]
    return { from: shiftIsoDay(today, -option.daysBack), to: shiftIsoDay(today, -option.lastDaysBack) }
  }, [rangeKey])

  const usage = useQuery({
    queryKey: QUERY_KEYS.adminSecurityNetworkUsage(range),
    queryFn: () => fetchUsage(range),
    enabled: usageActive,
    refetchInterval: usageActive ? 5 * 60 * 1000 : false,
  })
  const usageError = usage.error instanceof Error ? usage.error.message : null

  const days = useMemo(() => data?.days ?? [], [data])
  const totalBytes = days.reduce((sum, d) => sum + d.bytes, 0)
  const oldest = days.at(-1)?.date

  const handleDownload = async (row: ArchivedDay) => {
    if (downloading) return
    setDownloading(row.date)
    const toastId = toast.loading(`Preparing ${formatDay(row.date)}…`)
    try {
      await downloadDay(row.date)
      toast.success("Download ready", { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed", { id: toastId })
    } finally {
      setDownloading(null)
    }
  }

  const columns: DataTableColumn<ArchivedDay>[] = [
    {
      key: "date",
      label: "Day",
      sortable: true,
      accessor: (r) => r.date,
      render: (r) => <span className="font-medium">{formatDay(r.date)}</span>,
    },
    {
      key: "files",
      label: "Batches",
      sortable: true,
      accessor: (r) => r.files,
      render: (r) => formatNumber(r.files),
    },
    {
      key: "bytes",
      label: "Size",
      sortable: true,
      accessor: (r) => r.bytes,
      render: (r) => formatBytes(r.bytes),
      hideOnMobile: true,
    },
  ]

  const years = [...new Set(days.map((d) => d.date.slice(0, 4)))]
  const months = [...new Set(days.map((d) => d.date.slice(5, 7)))].sort()
  const filters: DataTableFilter<ArchivedDay>[] = [
    {
      key: "year",
      label: "Year",
      options: years.map((y) => ({ value: y, label: y })),
      mode: "custom",
      filterFn: (row, values) => values.includes(row.date.slice(0, 4)),
    },
    {
      key: "month",
      label: "Month",
      options: months.map((m) => ({ value: m, label: MONTH_LABELS[Number(m) - 1] ?? m })),
      mode: "custom",
      filterFn: (row, values) => values.includes(row.date.slice(5, 7)),
    },
  ]

  const totals = usage.data?.totals
  const usageBadges = totals
    ? [
        { label: `${formatBytes(totals.downloadBytes)} downloaded`, icon: Download },
        { label: `${formatBytes(totals.uploadBytes)} uploaded`, icon: Upload },
        {
          label:
            totals.officeDownloadBytes > 0
              ? `${formatBytes(totals.officeDownloadBytes)} on the office line`
              : "office line not recorded yet",
          icon: Wifi,
        },
        {
          label: usage.data?.trackingSince
            ? `tracking since ${formatDay(usage.data.trackingSince)}`
            : "tracking not started",
          icon: CalendarDays,
        },
      ]
    : []

  const description =
    tab === "logs"
      ? `Office network logs, archived daily to SharePoint and kept for ${data?.retentionMonths ?? 12} months. Download a day to investigate it in Excel.`
      : tab === "usage"
        ? "How much each login downloaded and uploaded, from the router's hotspot counters. Updated every 5 minutes."
        : "Each day's counted usage next to what came in on the office line, to compare with the Starlink portal."

  return (
    <DataTablePage
      title="Network Activity"
      description={description}
      icon={ShieldCheck}
      tabs={TABS}
      activeTab={tab}
      onTabChange={(next) => setTab(next as TabKey)}
      actions={
        usageActive ? (
          <Select value={rangeKey} onValueChange={(value) => setRangeKey(value as RangeKey)}>
            <SelectTrigger className="w-[150px]" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
      statBadgeStyle="line"
      statBadges={
        usageActive
          ? usageBadges
          : [
              { label: `${days.length} days archived`, icon: CalendarDays },
              { label: `${formatBytes(totalBytes)} stored`, icon: HardDrive },
              { label: oldest ? `since ${formatDay(oldest)}` : "no archive yet", icon: Archive },
            ]
      }
    >
      {tab === "logs" && (
        <DataTable<ArchivedDay>
          data={days}
          columns={columns}
          getRowId={(r) => r.date}
          searchPlaceholder="Search a date, e.g. 2026-10-01…"
          searchFn={(row, q) => row.date.includes(q) || formatDay(row.date).toLowerCase().includes(q)}
          filters={filters}
          isLoading={isLoading}
          error={error instanceof Error ? error.message : null}
          onRetry={() => void refetch()}
          pagination={{ pageSize: 50 }}
          rowActions={[
            { label: "Download CSV", icon: Download, onClick: (row) => void handleDownload(row) },
            {
              label: "Open in SharePoint",
              icon: ExternalLink,
              onClick: (row) => window.open(row.webUrl, "_blank", "noopener"),
            },
          ]}
        />
      )}
      {tab === "usage" && (
        <UsageByPersonTable
          users={usage.data?.users ?? []}
          isLoading={usage.isLoading}
          error={usageError}
          onRetry={() => void usage.refetch()}
        />
      )}
      {tab === "days" && (
        <UsageByDayTable
          days={usage.data?.days ?? []}
          isLoading={usage.isLoading}
          error={usageError}
          onRetry={() => void usage.refetch()}
        />
      )}
    </DataTablePage>
  )
}
