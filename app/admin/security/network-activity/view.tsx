"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { Archive, CalendarDays, Download, ExternalLink, HardDrive, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { QUERY_KEYS } from "@/lib/query-keys"

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

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

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
  const res = await fetch("/api/admin/security/network-activity", { cache: "no-store" })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? "Failed to load the network log archive")
  return body.data as ArchiveResponse
}

async function downloadDay(date: string) {
  const res = await fetch(`/api/admin/security/network-activity/download?date=${date}`, { cache: "no-store" })
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
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.adminSecurityNetworkActivity(),
    queryFn: fetchArchive,
  })
  const [downloading, setDownloading] = useState<string | null>(null)

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
      render: (r) => r.files.toLocaleString(),
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

  return (
    <DataTablePage
      title="Network Activity"
      description={`Office network logs, archived daily to SharePoint and kept for ${data?.retentionMonths ?? 12} months. Download a day to investigate it in Excel.`}
      icon={ShieldCheck}
      backLink={{ href: backLinkHref ?? "/admin/security", label: "Back to Security" }}
      statBadgeStyle="line"
      statBadges={[
        { label: `${days.length} days archived`, icon: CalendarDays },
        { label: `${formatBytes(totalBytes)} stored`, icon: HardDrive },
        { label: oldest ? `since ${formatDay(oldest)}` : "no archive yet", icon: Archive },
      ]}
    >
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
    </DataTablePage>
  )
}
