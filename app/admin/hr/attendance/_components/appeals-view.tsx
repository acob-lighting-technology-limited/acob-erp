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
import { formatWATDate, formatWATDateTime } from "@/lib/utils/date"
import { AppealReviewDialog } from "./appeal-review-dialog"
import type { AppealRow } from "./appeal-review-dialog"
import { apiJson } from "@/lib/api-client"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"

interface AppealsViewProps {
  lockedDepartment?: string
}

function statusBadge(
  status: AppealRow["status"],
  stage?: AppealRow["stage"],
  initiatedByRole?: AppealRow["initiated_by_role"]
) {
  if (status === "approved") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Approved</Badge>
    )
  }
  if (status === "rejected") {
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Rejected</Badge>
  }
  // Closed because the day was changed directly rather than through the appeal.
  if (status === "resolved") {
    return <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">Resolved</Badge>
  }
  if (stage === "pending_lead") {
    if (initiatedByRole === "admin_manual") {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pending Lead</Badge>
      )
    }
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pending Both</Badge>
  }
  if (stage === "pending_admin") {
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Pending Admin</Badge>
  }
  if (stage === "pending_hr_lead") {
    return (
      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
        Pending HR Lead
      </Badge>
    )
  }
  return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pending</Badge>
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
          <div className="flex items-center gap-2.5">
            <StaffAvatar name={r.user_name} profileId={r.user_id} src={staffAvatars[r.user_id]} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium">{r.user_name}</div>
              <div className="text-muted-foreground text-xs">{r.department}</div>
            </div>
          </div>
        ),
        resizable: true,
        initialWidth: 220,
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
                ATTENDANCE_STATUS_COLORS[r.current_status as UnifiedAttendanceStatus] ?? "bg-gray-100 text-gray-800"
              }
            >
              {ATTENDANCE_STATUS_LABELS[r.current_status as UnifiedAttendanceStatus] ?? r.current_status}
            </Badge>
            {/* The snapshot can go stale when device punches arrive late. */}
            {r.status === "pending" && r.live_status && r.live_status !== r.current_status && (
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
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
              ATTENDANCE_STATUS_COLORS[r.requested_status as UnifiedAttendanceStatus] ?? "bg-blue-100 text-blue-800"
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
        label: "Status / Stage",
        sortable: true,
        accessor: (r) => r.stage ?? r.status,
        render: (r) => statusBadge(r.status, r.stage, r.initiated_by_role),
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
          leading: (r) => (
            <StaffAvatar name={r.user_name} profileId={r.user_id} src={staffAvatars[r.user_id]} size="sm" />
          ),
          title: (r) => `${r.user_name} · ${r.department}`,
          subtitle: (r) => `${formatWATDate(r.appeal_date)} · ${r.current_status} ➔ ${r.requested_status}`,
          snippet: (r) => (r.appeal_reason ? `Reason: ${r.appeal_reason}` : null),
          expandInline: true,
          trailing: (r) => statusBadge(r.status, r.stage, r.initiated_by_role),
          detail: {
            title: (r) => `${r.user_name} (${r.department})`,
            subtitle: (r) => `Appeal for ${formatWATDate(r.appeal_date)}`,
            badges: (r) => statusBadge(r.status, r.stage, r.initiated_by_role),
            fields: (r) => [
              { label: "Appeal Date", value: formatWATDate(r.appeal_date) },
              { label: "Current Status", value: r.current_status },
              { label: "Requested Status", value: r.requested_status },
              { label: "Status", value: r.status },
              {
                label: "Origin",
                value: `${r.initiated_by_role === "admin_manual" ? "Admin Manual Alteration" : r.initiated_by_role === "lead_on_behalf" ? "Lead on Behalf" : "Employee Appeal"} by ${r.created_by_name || (r.initiated_by_role === "employee" ? r.user_name : "Admin")} (${formatWATDateTime(r.created_at)})`,
                fullWidth: true,
              },
              {
                label: "Lead Endorsement",
                value: r.lead_reviewed_at
                  ? `Endorsed by ${r.lead_reviewer_name || "Department Lead"} on ${formatWATDateTime(r.lead_reviewed_at)}${r.lead_resolution_note ? ` — "${r.lead_resolution_note}"` : ""}`
                  : r.stage === "pending_lead"
                    ? "Pending Lead Endorsement"
                    : "Not required / Bypassed",
                fullWidth: true,
              },
              {
                label: "Admin Review",
                value: r.admin_reviewed_at
                  ? `Reviewed by ${r.admin_reviewer_name || r.reviewer_name || "Admin"} on ${formatWATDateTime(r.admin_reviewed_at)}${r.admin_resolution_note || r.resolution_note ? ` — "${r.admin_resolution_note || r.resolution_note}"` : ""}`
                  : r.status === "approved" || r.status === "rejected"
                    ? `Reviewed by ${r.reviewer_name || "Admin"}${r.reviewed_at ? ` on ${formatWATDateTime(r.reviewed_at)}` : ""}${r.resolution_note ? ` — "${r.resolution_note}"` : ""}`
                    : r.stage === "pending_admin"
                      ? "Pending Admin Review"
                      : "Pending Lead stage",
                fullWidth: true,
              },
              { label: "Appeal Reason", value: r.appeal_reason || "No reason specified", fullWidth: true },
              ...(r.resolution_note ? [{ label: "Resolution Note", value: r.resolution_note, fullWidth: true }] : []),
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
              {statusBadge(r.status, r.stage, r.initiated_by_role)}
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
          {
            label: "View Details",
            onClick: (row) => setReviewAppeal(row),
            hidden: (row) => row.status === "pending",
          },
        ]}
        expandable={{
          render: (r) => (
            <div className="bg-muted/20 space-y-3.5 border-y p-4 text-sm">
              <div>
                <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wide uppercase">
                  {r.initiated_by_role === "admin_manual" ? "Admin's Reason" : "Appeal Reason"}
                </span>
                <p className="text-foreground text-sm font-medium whitespace-pre-wrap">
                  {r.appeal_reason || "No reason specified"}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-3">
                {/* 1. Origin */}
                <div className="bg-background/80 space-y-1 rounded-lg border p-3 text-xs">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    Origin / Initiator
                  </span>
                  <div className="text-foreground font-medium">
                    {r.initiated_by_role === "admin_manual"
                      ? "Admin Manual Alteration"
                      : r.initiated_by_role === "lead_on_behalf"
                        ? "Lead on Behalf"
                        : "Employee Appeal"}
                  </div>
                  <div className="text-muted-foreground">
                    By: {r.created_by_name || (r.initiated_by_role === "employee" ? r.user_name : "Admin")}
                  </div>
                  <div className="text-muted-foreground">{formatWATDateTime(r.created_at)}</div>
                </div>

                {/* 2. Lead Endorsement */}
                <div className="bg-background/80 space-y-1 rounded-lg border p-3 text-xs">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    Lead Endorsement
                  </span>
                  {r.lead_reviewed_at ? (
                    <>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400">Endorsed</div>
                      <div className="text-muted-foreground">By: {r.lead_reviewer_name || "Department Lead"}</div>
                      <div className="text-muted-foreground">{formatWATDateTime(r.lead_reviewed_at)}</div>
                      {r.lead_resolution_note && (
                        <p className="text-muted-foreground mt-1 border-t pt-1 italic">
                          &ldquo;{r.lead_resolution_note}&rdquo;
                        </p>
                      )}
                    </>
                  ) : r.stage === "pending_lead" ? (
                    <div className="font-medium text-amber-600 dark:text-amber-400">Awaiting Lead endorsement</div>
                  ) : (
                    <div className="text-muted-foreground">Not required / Bypassed</div>
                  )}
                </div>

                {/* 3. Admin Review */}
                <div className="bg-background/80 space-y-1 rounded-lg border p-3 text-xs">
                  <span className="text-muted-foreground block text-xs font-semibold tracking-wide uppercase">
                    Admin Review
                  </span>
                  {r.admin_reviewed_at ? (
                    <>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400">
                        {r.status === "rejected" ? "Rejected" : "Approved"}
                      </div>
                      <div className="text-muted-foreground">
                        By: {r.admin_reviewer_name || r.reviewer_name || "Admin"}
                      </div>
                      <div className="text-muted-foreground">{formatWATDateTime(r.admin_reviewed_at)}</div>
                      {(r.admin_resolution_note || r.resolution_note) && (
                        <p className="text-muted-foreground mt-1 border-t pt-1 italic">
                          &ldquo;{r.admin_resolution_note || r.resolution_note}&rdquo;
                        </p>
                      )}
                    </>
                  ) : r.status === "approved" || r.status === "rejected" ? (
                    <>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400">
                        {r.status === "rejected" ? "Rejected" : "Approved"}
                      </div>
                      {r.reviewer_name && <div className="text-muted-foreground">By: {r.reviewer_name}</div>}
                      {r.reviewed_at && <div className="text-muted-foreground">{formatWATDateTime(r.reviewed_at)}</div>}
                      {r.resolution_note && (
                        <p className="text-muted-foreground mt-1 border-t pt-1 italic">
                          &ldquo;{r.resolution_note}&rdquo;
                        </p>
                      )}
                    </>
                  ) : r.stage === "pending_admin" ? (
                    <div className="font-medium text-blue-600 dark:text-blue-400">Awaiting Admin review</div>
                  ) : (
                    <div className="text-muted-foreground">Pending Lead stage</div>
                  )}
                </div>
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
