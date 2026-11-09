"use client"

import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { ATTENDANCE_STATUS_LABELS, type UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import type { SelfApprovedAppeal } from "@/lib/hr/self-approved"
import { formatWATDate } from "@/lib/utils/date"

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number)
  return formatWATDate(new Date(Date.UTC(year, m - 1, 1)), { month: "long", year: "numeric", day: undefined })
}

function statusLabel(status: string) {
  return ATTENDANCE_STATUS_LABELS[status as UnifiedAttendanceStatus] ?? status
}

/**
 * MD's Desk → Self-approved appeals. Attendance appeals decided by the person they are
 * about: the Admin & HR Lead deciding her own, or her delegate doing so while she was on
 * approved leave. Nobody sits above them in the appeal chain, so they are listed here for
 * the MD to look at afterwards, with a monthly in-app notice.
 */
export function MdDeskSelfApproved({ rows }: { rows: SelfApprovedAppeal[] }) {
  const months = Array.from(new Set(rows.map((row) => row.month)))
    .sort()
    .reverse()
  const thisMonth = months[0]
  const people = new Set(rows.map((row) => row.user_id)).size

  const columns: DataTableColumn<SelfApprovedAppeal>[] = [
    {
      key: "user_name",
      label: "Person",
      sortable: true,
      accessor: (row) => row.user_name,
      render: (row) => <span className="font-medium">{row.user_name}</span>,
    },
    {
      key: "appeal_date",
      label: "Day appealed",
      sortable: true,
      accessor: (row) => row.appeal_date,
    },
    {
      key: "requested_status",
      label: "Approved as",
      sortable: true,
      accessor: (row) => statusLabel(row.requested_status),
      render: (row) => <Badge variant="outline">{statusLabel(row.requested_status)}</Badge>,
    },
    {
      key: "reviewed_at",
      label: "Approved on",
      sortable: true,
      accessor: (row) => row.reviewed_at,
      render: (row) => formatWATDate(row.reviewed_at),
    },
    {
      key: "appeal_reason",
      label: "Reason",
      hideOnMobile: true,
      accessor: (row) => row.appeal_reason ?? "",
    },
  ]

  const filters: DataTableFilter<SelfApprovedAppeal>[] = [
    {
      key: "month",
      label: "Month approved",
      options: months.map((month) => ({ value: month, label: monthLabel(month) })),
    },
    {
      key: "user_name",
      label: "Person",
      options: Array.from(new Set(rows.map((row) => row.user_name)))
        .sort()
        .map((name) => ({ value: name, label: name })),
    },
  ]

  return (
    <DataTablePage
      title="Self-approved appeals"
      description="Attendance appeals approved by the person they are about. Listed here so someone above the approval chain can look at them."
      icon={ShieldCheck}
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Last 6 months"
            value={rows.length}
            icon={ShieldCheck}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title={thisMonth ? monthLabel(thisMonth) : "Latest month"}
            value={thisMonth ? rows.filter((row) => row.month === thisMonth).length : 0}
            icon={ShieldCheck}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            variant="compact"
            title="People"
            value={people}
            icon={ShieldCheck}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
        </StatGrid>
      }
    >
      <DataTable<SelfApprovedAppeal>
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 25 }}
        searchPlaceholder="Search people or reasons..."
        searchFn={(row, query) =>
          `${row.user_name} ${row.appeal_reason ?? ""}`.toLowerCase().includes(query.toLowerCase())
        }
        emptyTitle="No self-approved appeals"
        emptyDescription="Nothing in the last six months."
      />
    </DataTablePage>
  )
}
