"use client"

import { useMemo, useState } from "react"
import { DataTable, DateTile } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, XCircle, FileQuestion } from "lucide-react"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/hr/attendance-status"
import type { UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { formatWATDate } from "@/lib/utils/date"
import { AppealReviewDialog } from "./appeal-review-dialog"
import type { AppealRow } from "./appeal-review-dialog"
import { apiJson } from "@/lib/api-client"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

interface AppealsViewProps {
  lockedDepartment?: string
}

function statusBadge(status: AppealRow["status"]) {
  if (status === "approved") return <Badge className="bg-success-muted text-success-foreground">Approved</Badge>
  if (status === "rejected") return <Badge className="bg-danger-muted text-danger-foreground">Rejected</Badge>
  // Closed because the day was changed directly rather than through the appeal.
  if (status === "resolved") return <Badge className="bg-info-muted text-info-foreground">Resolved</Badge>
  return <Badge className="bg-warning-muted text-warning-foreground">Pending</Badge>
}

export function AppealsView({ lockedDepartment }: AppealsViewProps) {
  const [reviewAppeal, setReviewAppeal] = useState<AppealRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const {
    data: appeals = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.attendanceAppeals({ statusFilter, lockedDepartment }),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (lockedDepartment) params.set("department", lockedDepartment)
      const payload = await apiJson<{ data?: AppealRow[] }>(`/api/admin/hr/attendance/appeals?${params.toString()}`, {
        cache: "no-store",
      })
      return payload.data ?? []
    },
    placeholderData: keepPreviousData,
    meta: { errorMessage: "Failed to load appeals" },
  })
  const load = async (..._args: unknown[]) => {
    await refetch()
  }

  const stats = useMemo(() => {
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const pending = appeals.filter((a) => a.status === "pending").length
    const approvedThisMonth = appeals.filter(
      (a) => a.status === "approved" && a.created_at.startsWith(currentYM)
    ).length
    const rejectedThisMonth = appeals.filter(
      (a) => a.status === "rejected" && a.created_at.startsWith(currentYM)
    ).length
    return { pending, approvedThisMonth, rejectedThisMonth }
  }, [appeals])

  // Collect unique departments for filter
  const departmentOptions = useMemo(() => {
    if (lockedDepartment) return [{ value: lockedDepartment, label: lockedDepartment }]
    const depts = Array.from(new Set(appeals.map((a) => a.department).filter(Boolean)))
    return depts.map((d) => ({ value: d, label: d }))
  }, [appeals, lockedDepartment])

  const columns = useMemo<DataTableColumn<AppealRow>[]>(
    () => [
      {
        key: "user_name",
        label: "Employee",
        sortable: true,
        accessor: (r) => r.user_name,
        render: (r) => (
          <div>
            <div className="font-medium">{r.user_name}</div>
            <div className="text-muted-foreground text-xs">{r.department}</div>
          </div>
        ),
        resizable: true,
        initialWidth: 180,
      },
      {
        key: "appeal_date",
        label: "Date",
        sortable: true,
        accessor: (r) => r.appeal_date,
        render: (r) => (
          <span className="font-medium">
            {formatWATDate(r.appeal_date, { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        ),
      },
      {
        key: "current_status",
        label: "Status when appealed",
        accessor: (r) => r.current_status,
        render: (r) => (
          <div className="flex flex-col items-start gap-1">
            <Badge
              className={
                ATTENDANCE_STATUS_COLORS[r.current_status as UnifiedAttendanceStatus] ??
                "bg-neutral-muted text-neutral-foreground"
              }
            >
              {ATTENDANCE_STATUS_LABELS[r.current_status as UnifiedAttendanceStatus] ?? r.current_status}
            </Badge>
            {/* The snapshot can go stale when device punches arrive late. */}
            {r.status === "pending" && r.live_status && r.live_status !== r.current_status && (
              <span className="text-warning-foreground text-xs font-medium">
                Now: {ATTENDANCE_STATUS_LABELS[r.live_status as UnifiedAttendanceStatus] ?? r.live_status}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "requested_status",
        label: "Requesting",
        accessor: (r) => r.requested_status,
        render: (r) => (
          <Badge
            className={
              ATTENDANCE_STATUS_COLORS[r.requested_status as UnifiedAttendanceStatus] ??
              "bg-info-muted text-info-foreground"
            }
          >
            {ATTENDANCE_STATUS_LABELS[r.requested_status as UnifiedAttendanceStatus] ?? r.requested_status}
          </Badge>
        ),
      },

      {
        key: "created_at",
        label: "Submitted",
        sortable: true,
        accessor: (r) => r.created_at,
        render: (r) => (
          <span className="text-muted-foreground text-sm">
            {formatWATDate(r.created_at, { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => statusBadge(r.status),
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<AppealRow>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "resolved", label: "Resolved manually" },
        ],
        placeholder: "All Statuses",
      },
      {
        key: "department",
        label: "Department",
        options: departmentOptions,
        placeholder: lockedDepartment || "All Departments",
      },
    ],
    [departmentOptions, lockedDepartment]
  )

  return (
    <>
      {/* Stats */}
      <StatGrid className="mb-4">
        <StatCard
          variant="compact"
          title="Total Pending"
          value={stats.pending}
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          variant="compact"
          title="Approved This Month"
          value={stats.approvedThisMonth}
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          variant="compact"
          title="Rejected This Month"
          value={stats.rejectedThisMonth}
          icon={XCircle}
          iconBgColor="bg-red-500/10"
          iconColor="text-red-500"
        />
      </StatGrid>

      <DataTable<AppealRow>
        data={appeals}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        searchPlaceholder="Search employee or department…"
        searchFn={(r, q) => [r.user_name, r.department].join(" ").toLowerCase().includes(q)}
        pagination={{ pageSize: 50 }}
        isLoading={loading}
        viewToggle
        contactsView
        stickyToolbar
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          leading: (r) => <DateTile date={r.appeal_date} />,
          title: (r) => `${r.user_name} · ${r.department}`,
          subtitle: (r) =>
            `${ATTENDANCE_STATUS_LABELS[r.current_status as UnifiedAttendanceStatus] ?? r.current_status} → ${
              ATTENDANCE_STATUS_LABELS[r.requested_status as UnifiedAttendanceStatus] ?? r.requested_status
            }`,
          trailing: (r) => statusBadge(r.status),
          onSelect: (r) => {
            if (r.status === "pending") setReviewAppeal(r)
          },
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{r.user_name}</p>
                <p className="text-muted-foreground text-xs">{r.department}</p>
              </div>
              {statusBadge(r.status)}
            </div>
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Date: {formatWATDate(r.appeal_date)}</span>
              <span>
                {r.current_status} ➔ {r.requested_status}
              </span>
            </div>
            {r.appeal_reason && (
              <p className="text-muted-foreground line-clamp-2 border-t pt-2 text-xs">{r.appeal_reason}</p>
            )}
          </div>
        )}
        emptyTitle="No appeals found"
        emptyDescription="No attendance appeals match your current filters."
        emptyIcon={FileQuestion}
        rowActions={[
          {
            label: "Review",
            onClick: (row) => setReviewAppeal(row),
            hidden: (row) => row.status !== "pending",
          },
        ]}
        expandable={{
          render: (r) => (
            <div className="bg-muted/20 space-y-3 border-y p-4 text-sm">
              <div>
                <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wide uppercase">
                  Appeal Reason
                </span>
                <p className="text-foreground text-sm font-medium whitespace-pre-wrap">{r.appeal_reason}</p>
              </div>
              {r.resolution_note && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wide uppercase">
                    Resolution Note
                  </span>
                  <p className="text-muted-foreground text-sm font-medium whitespace-pre-wrap">{r.resolution_note}</p>
                </div>
              )}
            </div>
          ),
        }}
      />

      <AppealReviewDialog
        appeal={reviewAppeal}
        open={reviewAppeal !== null}
        onClose={() => setReviewAppeal(null)}
        onSuccess={() => {
          setReviewAppeal(null)
          void load()
        }}
      />
    </>
  )
}
