"use client"

import { useMemo, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, XCircle, FileQuestion } from "lucide-react"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/hr/attendance-status"
import type { UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { formatWATDate } from "@/lib/utils/date"
import { AppealReviewDialog, appealDateLabel } from "./appeal-review-dialog"
import type { AppealRow } from "./appeal-review-dialog"
import { AppealAuditTrail, appealAuditLines } from "@/components/hr/appeal-audit-trail"
import { apiJson } from "@/lib/api-client"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"

interface AppealsViewProps {
  lockedDepartment?: string
}

/**
 * One row per item: the days of a range staged as one batch (same person, same state)
 * are folded into a single row that is reviewed and decided as a whole.
 */
function groupBatches(appeals: AppealRow[]): AppealRow[] {
  const groups = new Map<string, AppealRow[]>()
  const order: string[] = []
  for (const appeal of appeals) {
    const key = appeal.batch_id ? `${appeal.batch_id}:${appeal.status}:${appeal.stage ?? ""}` : appeal.id
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(appeal)
  }
  return order.map((key) => {
    const days = [...groups.get(key)!].sort((a, b) => a.appeal_date.localeCompare(b.appeal_date))
    if (days.length === 1) return days[0]
    return { ...days[0], days, appeal_date_end: days[days.length - 1].appeal_date }
  })
}

function renderStatusBadge(r: AppealRow) {
  if (r.overridden_at) {
    return <Badge className="bg-warning/15 text-warning">Overridden</Badge>
  }

  if (r.status === "approved") {
    return <Badge className="bg-success/15 text-success">Approved</Badge>
  }

  if (r.status === "rejected") {
    return <Badge className="bg-danger/15 text-danger">Rejected</Badge>
  }

  // Closed because the day was changed directly rather than through the appeal.
  if (r.status === "resolved") {
    return <Badge className="bg-info/15 text-info">Resolved</Badge>
  }

  if (r.stage === "pending_lead") {
    if (r.initiated_by_role === "admin_manual") {
      return <Badge className="bg-warning/15 text-warning">Pending Lead</Badge>
    }
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge className="bg-warning/15 text-warning">Pending Lead</Badge>
        <Badge className="bg-info/15 text-info">Pending Admin</Badge>
      </div>
    )
  }

  if (r.stage === "pending_admin") {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge className="bg-info/15 text-info">Pending Admin</Badge>
        {r.lead_reviewer_name ? <span className="text-success pl-0.5 text-xs font-medium">Lead Endorsed ✓</span> : null}
      </div>
    )
  }

  if (r.stage === "pending_hr_lead") {
    return <Badge className="bg-purple/15 text-purple">Pending Admin & HR Lead</Badge>
  }

  return <Badge className="bg-warning/15 text-warning">Pending</Badge>
}

export function AppealsView({ lockedDepartment }: AppealsViewProps) {
  const staffAvatars = useStaffAvatars()
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

  const rows = useMemo(() => groupBatches(appeals), [appeals])

  const stats = useMemo(() => {
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const pending = rows.filter((a) => a.status === "pending").length
    const approvedThisMonth = rows.filter((a) => a.status === "approved" && a.created_at.startsWith(currentYM)).length
    const rejectedThisMonth = rows.filter((a) => a.status === "rejected" && a.created_at.startsWith(currentYM)).length
    return { pending, approvedThisMonth, rejectedThisMonth }
  }, [rows])

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
          <div className="flex items-center gap-2.5">
            <StaffAvatar name={r.user_name} profileId={r.user_id} src={staffAvatars[r.user_id]} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium">{r.user_name}</div>
              <div className="text-muted-foreground text-xs">{r.department}</div>
            </div>
          </div>
        ),
        resizable: true,
        initialWidth: 200,
      },
      {
        key: "appeal_date",
        label: "Day Appealed",
        sortable: true,
        accessor: (r) => r.appeal_date,
        render: (r) => (
          <div>
            <span className="font-medium">{appealDateLabel(r)}</span>
            <div className="text-muted-foreground text-xs">
              Submitted {formatWATDate(r.created_at, { day: "2-digit", month: "short" })}
            </div>
          </div>
        ),
      },
      {
        key: "requested_status",
        label: "Status Change",
        accessor: (r) => `${r.current_status} -> ${r.requested_status}`,
        render: (r) => (
          <div className="flex flex-col items-start gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                className={
                  ATTENDANCE_STATUS_COLORS[r.current_status as UnifiedAttendanceStatus] ??
                  "bg-muted text-muted-foreground"
                }
              >
                {ATTENDANCE_STATUS_LABELS[r.current_status as UnifiedAttendanceStatus] ?? r.current_status}
              </Badge>
              <span className="text-muted-foreground text-xs font-semibold">→</span>
              <Badge
                className={
                  ATTENDANCE_STATUS_COLORS[r.requested_status as UnifiedAttendanceStatus] ?? "bg-info/15 text-info"
                }
              >
                {ATTENDANCE_STATUS_LABELS[r.requested_status as UnifiedAttendanceStatus] ?? r.requested_status}
              </Badge>
            </div>
            {/* The snapshot can go stale when device punches arrive late. */}
            {r.status === "pending" && r.live_status && r.live_status !== r.current_status && (
              <span className="text-warning text-xs font-medium">
                Now: {ATTENDANCE_STATUS_LABELS[r.live_status as UnifiedAttendanceStatus] ?? r.live_status}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status / Stage",
        sortable: true,
        accessor: (r) => r.stage ?? r.status,
        render: (r) => renderStatusBadge(r),
      },
    ],
    [staffAvatars]
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
        key: "decision",
        label: "Decision",
        options: [{ value: "override", label: "Overrides only" }],
        placeholder: "All Decisions",
        mode: "custom",
        filterFn: (row, values) => values.length === 0 || (values.includes("override") && Boolean(row.overridden_at)),
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
        data={rows}
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
          leading: (r) => (
            <StaffAvatar name={r.user_name} profileId={r.user_id} src={staffAvatars[r.user_id]} size="sm" />
          ),
          title: (r) => `${r.user_name} · ${r.department}`,
          subtitle: (r) => `${appealDateLabel(r)} · ${r.current_status} ➔ ${r.requested_status}`,
          snippet: (r) => (r.appeal_reason ? `Reason: ${r.appeal_reason}` : null),
          expandInline: true,
          trailing: (r) => renderStatusBadge(r),
          detail: {
            title: (r) => `${r.user_name} (${r.department})`,
            subtitle: (r) => `Appeal for ${appealDateLabel(r)}`,
            badges: (r) => renderStatusBadge(r),
            fields: (r) => [
              { label: "Days", value: appealDateLabel(r) },
              { label: "Current Status", value: r.current_status },
              { label: "Requested Status", value: r.requested_status },
              { label: "Status", value: r.overridden_at ? "overridden" : r.status },
              ...appealAuditLines(r).map((line) => ({ ...line, fullWidth: true })),
              { label: "Appeal Reason", value: r.appeal_reason || "No reason specified", fullWidth: true },
            ],
            actions: (r) => [
              {
                label: r.status === "pending" ? "Review Appeal" : "View Details",
                variant: r.status === "pending" ? "default" : "outline",
                onClick: () => setReviewAppeal(r),
              },
            ],
          },
          onSelect: (r) => {
            setReviewAppeal(r)
          },
        }}
        cardRenderer={(r) => (
          <div className="bg-card space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{r.user_name}</p>
                <p className="text-muted-foreground text-xs">{r.department}</p>
              </div>
              {renderStatusBadge(r)}
            </div>
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>{appealDateLabel(r)}</span>
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
          {
            label: "View Details",
            onClick: (row) => setReviewAppeal(row),
            hidden: (row) => row.status === "pending",
          },
        ]}
        expandable={{
          render: (r) => (
            <div className="space-y-3.5 text-sm">
              <div>
                <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wide uppercase">
                  {r.initiated_by_role === "admin_manual" ? "Admin's Reason" : "Appeal Reason"}
                </span>
                <p className="text-foreground text-sm font-medium whitespace-pre-wrap">
                  {r.appeal_reason || "No reason specified"}
                </p>
              </div>

              <div className="border-t pt-3">
                <span className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wide uppercase">
                  Audit History
                </span>
                <AppealAuditTrail appeal={r} />
              </div>
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
