"use client"

import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import {
  Clock,
  History,
  CalendarCheck2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Check,
  X,
  FileText,
  Plus,
  CalendarDays,
  Users,
  Building2,
  Mail,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { LeaveDetailSheet } from "./_components/leave-detail-sheet"
import {
  LeaveApprovalStages,
  LeaveAttachments,
  LeaveDetailsList,
  LeaveOverlapNotice,
  LeaveStatusStrip,
} from "./_components/leave-detail-sections"
import { SectionHeading } from "@/components/ui/detail-list"
import { AddLeaveDialog } from "./_components/add-leave-dialog"
import { useAdminScopeOptional } from "@/components/admin-scope-context"
import { LeaveCalendarView } from "./_components/leave-calendar-view"
import { formatName, cn } from "@/lib/utils"
import { apiFetch, apiJson } from "@/lib/api-client"
import { resolveLeaveRouteStages, type RouteSnapshotStage } from "@/lib/hr/leave-stages"

export { resolveLeaveRouteStages }
export type { RouteSnapshotStage }

export interface LeaveItem {
  id: string
  user_id: string
  start_date: string
  end_date: string
  resume_date: string
  days_count: number
  reason: string
  rejected_reason?: string | null
  handover_note?: string | null
  handover_checklist_url?: string | null
  status: string
  approval_stage: string
  current_stage_code?: string
  current_stage_order?: number
  current_approver_user_id?: string
  reliever_id?: string | null
  supervisor_id?: string | null
  requester_route_kind?: string | null
  route_snapshot?: RouteSnapshotStage[] | null
  department_overlaps?: Array<{
    id: string
    user_id: string
    full_name: string
    start_date: string
    end_date: string
    status: string
  }>
  created_at: string
  admin_manual?: boolean | null
  approved_at?: string | null
  user?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name: string
    company_email: string
    department?: string
  }
  reliever?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
    company_email?: string | null
  } | null
  supervisor?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
    company_email?: string | null
  } | null
  approved_by_profile?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
    company_email?: string | null
  } | null
  leave_type?: { name: string }
  current_approver?: { id: string; full_name: string; company_email: string; role?: string | null } | null
  approvals?: Array<{
    id: string
    approver_id?: string | null
    approval_level?: number | null
    status?: string | null
    comments?: string | null
    approved_at?: string | null
    stage_code?: string | null
    stage_order?: number | null
    approver?: {
      id?: string
      full_name?: string | null
      first_name?: string | null
      last_name?: string | null
      company_email?: string | null
    } | null
  }>
  evidence?: Array<{
    id: string
    document_type: string
    file_url: string
    status: "pending" | "verified" | "rejected"
    notes?: string | null
  }>
  required_documents?: string[]
  missing_documents?: string[]
  evidence_complete?: boolean
}

export interface LeaveActionHistoryItem {
  id: string
  leave_request_id: string
  status?: string | null
  comments?: string | null
  approved_at?: string | null
  stage_code?: string | null
  request?: LeaveItem | null
}

export type PersonNameRef = {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  company_email?: string | null
}

export const STAGE_LABELS: Record<string, string> = {
  pending_reliever: "Waiting Reliever",
  pending_department_lead: "Waiting Department Lead",
  pending_admin_hr_lead: "Waiting Admin and HR Lead",
  pending_md: "Waiting MD",
  pending_hcs: "Waiting HCS",
  reliever_pending: "Waiting Reliever",
  supervisor_pending: "Waiting Department Lead",
  hr_pending: "Waiting Admin and HR Lead",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

export function expectedApproverLabel(item: LeaveItem) {
  const status = String(item.status || "").toLowerCase()
  if (["approved", "completed", "rejected", "cancelled"].includes(status)) {
    return "-"
  }
  if (item.current_approver?.full_name) return item.current_approver.full_name
  const stageKey = approvalStageKey(item.current_stage_code || item.approval_stage)
  if (stageKey === "reliever") {
    const name = resolvePersonName(item.reliever)
    if (name) return name
  }
  if (stageKey === "department_lead") {
    const name = resolvePersonName(item.supervisor)
    if (name) return name
  }
  if (stageKey === "admin_hr_lead") {
    const name = resolvePersonName(item.approved_by_profile)
    if (name) return name
  }
  const expectedByStage: Record<string, string> = {
    reliever: "Assigned Reliever",
    department_lead: "Department Lead",
    admin_hr_lead: "Admin and HR Lead",
    md: "Managing Director (MD)",
    hcs: "Head, Corporate Services (HCS)",
  }
  return expectedByStage[stageKey] || "Pending approver"
}

export function getStageBadge(item: LeaveItem) {
  const rawStage = item.current_stage_code || item.approval_stage || ""
  const stage = rawStage.toLowerCase()
  const label = STAGE_LABELS[rawStage] || rawStage

  let colorClass = "bg-muted/10 text-muted-foreground border-muted-foreground/20"
  if (stage.includes("reliever")) {
    colorClass = "bg-purple-500/10 text-purple-500 border-purple-500/20"
  } else if (stage.includes("department_lead") || stage.includes("supervisor")) {
    colorClass = "bg-amber-500/10 text-amber-500 border-amber-500/20"
  } else if (stage.includes("admin_hr_lead") || stage.includes("hr_pending")) {
    colorClass = "bg-blue-500/10 text-blue-500 border-blue-500/20"
  } else if (stage.includes("md")) {
    colorClass = "bg-rose-500/10 text-rose-500 border-rose-500/20"
  } else if (stage.includes("hcs")) {
    colorClass = "bg-violet-500/10 text-violet-500 border-violet-500/20"
  } else if (stage === "completed" || stage === "approved") {
    colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  } else if (stage === "rejected") {
    colorClass = "bg-red-500/10 text-red-500 border-red-500/20"
  } else if (stage === "cancelled") {
    colorClass = "bg-muted/10 text-muted-foreground border-muted-foreground/20"
  }

  return (
    <Badge variant="outline" className={colorClass}>
      {label}
    </Badge>
  )
}

export function approvalStageKey(code?: string | null) {
  const value = String(code || "").toLowerCase()
  if (value.includes("reliever")) return "reliever"
  if (value.includes("department_lead")) return "department_lead"
  if (value.includes("admin_hr_lead")) return "admin_hr_lead"
  if (value.includes("hcs")) return "hcs"
  if (value.includes("md")) return "md"
  return value || "unknown"
}

export function approvalStageLabel(code?: string | null) {
  const value = String(code || "").toLowerCase()
  if (value.includes("reliever")) return "Reliever"
  if (value.includes("department_lead")) return "Department Lead"
  if (value.includes("admin_hr_lead")) return "Admin and HR Lead"
  if (value.includes("hcs")) return "HCS"
  if (value.includes("md")) return "MD"
  return formatName(code || "Stage")
}

export function resolvePersonName(person?: PersonNameRef | null) {
  if (!person) return ""
  const full = String(person.full_name || "").trim()
  if (full) return full
  const composed = `${person.first_name || ""} ${person.last_name || ""}`.trim()
  if (composed) return composed
  const email = String(person.company_email || "").trim()
  if (email) return email.split("@")[0] || email
  return ""
}

interface ActionDialogState {
  open: boolean
  id: string
  action: "approve" | "reject"
  missingDocuments: string[]
}

async function fetchLeaveApprovalData(apiBasePath: string): Promise<{
  myQueue: LeaveItem[]
  allPendingQueue: LeaveItem[]
  history: LeaveItem[]
  allRequests: LeaveItem[]
  reviewHistory: LeaveActionHistoryItem[]
}> {
  const myQueueRes = await apiFetch(`${apiBasePath}/queue`)
  if (!myQueueRes.ok) throw new Error("Failed to load leave queue")
  const myQueuePayload = await myQueueRes.json()

  let allQueuePayload: { data?: LeaveItem[] } = { data: [] }
  let requestPayload: { data?: LeaveItem[] } = { data: [] }
  const [allQueueRes, requestsRes] = await Promise.allSettled([
    apiFetch(`${apiBasePath}/queue?all=true`),
    apiFetch(`${apiBasePath}/requests?all=true&limit=100`),
  ])
  if (allQueueRes.status === "rejected") {
    throw new Error(`Queue fetch rejected: ${allQueueRes.reason}`)
  }
  if (!allQueueRes.value.ok) {
    const errorBody = await allQueueRes.value.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(
      `Queue fetch failed (${allQueueRes.value.status}): ${errorBody.error || allQueueRes.value.statusText}`
    )
  }
  allQueuePayload = await allQueueRes.value.json()

  if (requestsRes.status === "rejected") {
    throw new Error(`Requests fetch rejected: ${requestsRes.reason}`)
  }
  if (!requestsRes.value.ok) {
    const errorBody = await requestsRes.value.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(
      `Requests fetch failed (${requestsRes.value.status}): ${errorBody.error || requestsRes.value.statusText}`
    )
  }
  requestPayload = await requestsRes.value.json()

  const allRequests = (requestPayload.data || []) as LeaveItem[]
  return {
    myQueue: myQueuePayload.data || [],
    allPendingQueue: allQueuePayload.data || [],
    history: allRequests.filter(
      (item) => !["pending", "pending_evidence"].includes(String(item.status || "").toLowerCase())
    ),
    allRequests: allRequests,
    reviewHistory: myQueuePayload.history || [],
  }
}

export function LeaveApprovePage({
  backLinkHref,
  apiBasePath = "/api/hr/leave",
}: { backLinkHref?: string; apiBasePath?: string } = {}) {
  const normalizedApiBasePath = apiBasePath.replace(/\/$/, "")
  const queryClient = useQueryClient()
  const staffAvatars = useStaffAvatars()
  const [activeTab, setActiveTab] = useState("all")
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    open: false,
    id: "",
    action: "reject",
    missingDocuments: [],
  })
  const overrideEvidenceRef = useRef(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<LeaveItem | null>(null)
  // Admin screens read identity through the scoped API, not the browser Supabase client.
  const { data: currentUserId = null } = useQuery({
    queryKey: QUERY_KEYS.adminCurrentUser(),
    queryFn: async () =>
      (await apiJson<{ userId?: string }>("/api/admin/current-user", { cache: "no-store" })).userId ?? null,
    staleTime: 10 * 60 * 1000,
  })
  const [addLeaveOpen, setAddLeaveOpen] = useState(false)
  // Adding leave here creates it already approved, skipping the workflow, so it is
  // Admin & HR only - the server refuses leads too (requireAttendanceAdmin).
  const canAddLeave = Boolean(useAdminScopeOptional()?.isAdminLike)
  const [calendarStats, setCalendarStats] = useState<{
    total_days: number
    active_leaves: number
    approved_count: number
    pending_count: number
  }>({
    total_days: 0,
    active_leaves: 0,
    approved_count: 0,
    pending_count: 0,
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.leaveRequests({ scope: "approve", apiBasePath: normalizedApiBasePath }),
    queryFn: () => fetchLeaveApprovalData(normalizedApiBasePath),
  })

  const { mutateAsync: submitActionMutateAsync } = useMutation({
    mutationFn: async ({
      id,
      action,
      comments,
      overrideEvidence,
    }: {
      id: string
      action: "approve" | "reject"
      comments: string
      overrideEvidence: boolean
    }) => {
      const response = await apiFetch(`${normalizedApiBasePath}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leave_request_id: id, action, comments, override_evidence: overrideEvidence }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to process action")
      return payload
    },
    onSuccess: (payload) => {
      toast.success(payload.message || "Action completed")
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.leaveRequests({ scope: "approve", apiBasePath: normalizedApiBasePath }),
      })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests() })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to process action")
    },
  })

  const myQueueIds = useMemo(() => new Set((data?.myQueue || []).map((x) => x.id)), [data?.myQueue])

  const handleAction = (id: string, action: "approve" | "reject") => {
    const list =
      activeTab === "history" ? data?.history : activeTab === "pending" ? data?.allPendingQueue : data?.allRequests
    const target = list?.find((item) => item.id === id) || data?.allRequests?.find((item) => item.id === id)
    const needsOverride = action === "approve" && target && target.evidence_complete === false

    overrideEvidenceRef.current = needsOverride ?? false
    setActionDialog({
      open: true,
      id,
      action,
      missingDocuments: needsOverride ? target?.missing_documents || [] : [],
    })
  }

  const columns: DataTableColumn<LeaveItem>[] = useMemo(
    () => [
      {
        key: "employee",
        label: "Employee",
        sortable: true,
        resizable: true,
        initialWidth: 280,
        accessor: (r) => r.user?.full_name || "Employee",
        render: (r) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedLeaveDetail(r)
              setDetailDialogOpen(true)
            }}
            className="group/emp flex max-w-[280px] min-w-0 items-center gap-3 text-left focus:outline-hidden"
          >
            <StaffAvatar
              name={r.user?.full_name || "Employee"}
              src={staffAvatars[r.user_id]}
              profileId={r.user_id}
              className="h-8 w-8 shrink-0 text-xs shadow-xs"
            />
            <div className="flex min-w-0 flex-col">
              <span
                className="text-foreground group-hover/emp:text-primary truncate font-medium group-hover/emp:underline"
                title={r.user?.full_name || "Employee"}
              >
                {r.user?.full_name || "Employee"}
              </span>
              <span className="text-muted-foreground truncate text-xs" title={r.user?.company_email || undefined}>
                {r.user?.company_email}
              </span>
            </div>
          </button>
        ),
      },
      {
        key: "leave_type",
        label: "Leave Type",
        sortable: true,
        resizable: true,
        initialWidth: 150,
        accessor: (r) => r.leave_type?.name || "—",
        render: (r) => <span className="text-sm font-medium whitespace-nowrap">{r.leave_type?.name || "—"}</span>,
      },
      {
        key: "period",
        label: "Period",
        accessor: (r) => `${r.start_date} to ${r.end_date}`,
        render: (r) => (
          <div className="flex flex-col text-xs">
            <span>
              {r.start_date} to {r.end_date}
            </span>
            <span className="text-muted-foreground">{r.days_count} day(s)</span>
          </div>
        ),
      },
      {
        key: "department",
        label: "Department",
        sortable: true,
        accessor: (r) => r.user?.department || "-",
        hideOnMobile: true,
      },
      {
        key: "stage",
        label: "Current Stage",
        accessor: (r) =>
          STAGE_LABELS[r.current_stage_code || r.approval_stage] || r.current_stage_code || r.approval_stage,
        hideOnMobile: true,
        render: (r) => getStageBadge(r),
      },
      {
        key: "approver",
        label: "Pending Approver",
        accessor: (r) => expectedApproverLabel(r),
        hideOnMobile: true,
        render: (r) => <span className="text-sm">{expectedApproverLabel(r)}</span>,
      },
    ],
    [staffAvatars]
  )

  const dynamicTabs = useMemo(() => {
    const globalCount = data?.allPendingQueue.length ?? 0
    const historyCount = data?.history.length ?? 0
    const allCount = data?.allRequests.length ?? 0

    return [
      { key: "all", label: `All Requests (${allCount})`, icon: CalendarCheck2 },
      { key: "pending", label: `Pending Queue (${globalCount})`, icon: Clock },
      { key: "calendar", label: "Calendar", icon: CalendarDays },
      { key: "history", label: `History (${historyCount})`, icon: History },
    ]
  }, [data])

  const stats = useMemo(() => {
    const all = data?.allRequests || []
    const approved = all.filter((r) => ["approved", "completed"].includes(String(r.status || "").toLowerCase())).length
    const pending = all.filter((r) =>
      ["pending", "pending_evidence"].includes(String(r.status || "").toLowerCase())
    ).length
    const totalDays = all.reduce((sum, r) => sum + (r.days_count || 0), 0)
    return { total: all.length, approved, pending, totalDays }
  }, [data])

  const activeData = useMemo(() => {
    if (!data) return []
    if (activeTab === "pending") return data.allPendingQueue
    if (activeTab === "history") return data.history
    return data.allRequests
  }, [data, activeTab])

  const filters = useMemo(() => {
    const allData = data?.allRequests || []
    const statuses = Array.from(
      new Set(
        [...allData.map((x) => x.status), "pending", "pending_evidence", "approved", "rejected", "cancelled"].filter(
          Boolean
        )
      )
    )
    const leaveTypes = Array.from(new Set(allData.map((x) => x.leave_type?.name).filter(Boolean)))
    const departments = Array.from(new Set(allData.map((x) => x.user?.department).filter(Boolean)))

    return [
      {
        key: "leave_type",
        label: "Leave Type",
        options: leaveTypes.map((lt) => ({ value: lt as string, label: lt as string })),
        mode: "custom",
        filterFn: (row: LeaveItem, vals: string[]) => !row.leave_type?.name || vals.includes(row.leave_type.name),
        hidden: leaveTypes.length === 0,
      },
      {
        key: "department",
        label: "Department",
        options: departments.map((d) => ({ value: d as string, label: d as string })),
        mode: "custom",
        filterFn: (row: LeaveItem, vals: string[]) => !row.user?.department || vals.includes(row.user.department),
        hidden: departments.length === 0,
      },
      {
        key: "status",
        label: "Status",
        options: statuses.map((s) => ({ value: s as string, label: formatName(s as string) })),
        mode: "custom",
        filterFn: (row: LeaveItem, vals: string[]) => !row.status || vals.includes(row.status),
      },
      {
        key: "reviewer",
        label: "My Decisions",
        options: [{ value: "acted_by_me", label: "Acted by me" }],
        mode: "custom",
        filterFn: (row: LeaveItem, vals: string[]) => {
          if (!currentUserId || !vals.includes("acted_by_me")) return true
          const isApprover =
            row.approvals?.some((app) => app.approver_id === currentUserId || app.approver?.id === currentUserId) ??
            false
          const isManualBypasser = !!(row.admin_manual && row.approved_by_profile?.id === currentUserId)
          return isApprover || isManualBypasser
        },
      },
    ] as DataTableFilter<LeaveItem>[]
  }, [data, currentUserId])

  const isOverride = actionDialog.missingDocuments.length > 0

  return (
    <>
      <PromptDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog((s) => ({ ...s, open }))}
        title={
          actionDialog.action === "approve"
            ? isOverride
              ? "Override Incomplete Evidence"
              : "Approval Feedback"
            : "Rejection Reason"
        }
        description={
          actionDialog.action === "approve"
            ? isOverride
              ? `Evidence is incomplete (${actionDialog.missingDocuments.join(", ")}). Provide an override reason to proceed with approval.`
              : "Provide approval feedback before endorsing this leave request (optional)."
            : "Please provide a reason for rejecting this leave request."
        }
        label={
          actionDialog.action === "approve"
            ? isOverride
              ? "Override reason"
              : "Approval feedback (optional)"
            : "Rejection reason"
        }
        placeholder={
          actionDialog.action === "approve"
            ? isOverride
              ? "Explain why evidence requirement is being waived…"
              : "Enter approval feedback (optional)…"
            : "Enter rejection reason…"
        }
        inputType="textarea"
        required={actionDialog.action === "reject" || isOverride}
        confirmLabel={
          actionDialog.action === "approve" ? (isOverride ? "Approve with Override" : "Endorse Request") : "Reject"
        }
        confirmLoadingLabel={
          actionDialog.action === "approve" ? (isOverride ? "Approving..." : "Endorsing...") : "Rejecting..."
        }
        confirmVariant={actionDialog.action === "reject" ? "destructive" : "default"}
        onConfirm={async (value) => {
          await submitActionMutateAsync({
            id: actionDialog.id,
            action: actionDialog.action,
            comments: value,
            overrideEvidence: overrideEvidenceRef.current,
          })
        }}
      />

      <LeaveDetailSheet
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        leave={selectedLeaveDetail}
        onApprove={(id) => handleAction(id, "approve")}
        onReject={(id) => handleAction(id, "reject")}
        showActionButtons={selectedLeaveDetail ? myQueueIds.has(selectedLeaveDetail.id) : false}
      />

      <AddLeaveDialog
        open={addLeaveOpen}
        onOpenChange={setAddLeaveOpen}
        onAdded={() => {
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.leaveRequests({ scope: "approve", apiBasePath: normalizedApiBasePath }),
          })
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests() })
        }}
      />

      <DataTablePage
        title="Leave Approvals & Scheduling"
        description="Review leave applications, manage approval workflows, and view organizational leave calendar."
        icon={CalendarCheck2}
        backLink={backLinkHref ? { href: backLinkHref, label: "Back" } : undefined}
        actions={
          canAddLeave ? (
            <Button size="sm" onClick={() => setAddLeaveOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Leave</span>
              <span className="sm:hidden">Add</span>
            </Button>
          ) : undefined
        }
        stats={
          activeTab === "calendar" ? (
            <StatGrid>
              <StatCard
                variant="compact"
                title="On Leave"
                value={calendarStats.active_leaves}
                icon={Users}
                iconBgColor="bg-violet-500/10"
                iconColor="text-violet-500"
              />
              <StatCard
                variant="compact"
                title="Approved"
                value={calendarStats.approved_count}
                icon={CheckCircle2}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-500"
              />
              <StatCard
                variant="compact"
                title="Pending"
                value={calendarStats.pending_count}
                icon={Clock}
                iconBgColor="bg-amber-500/10"
                iconColor="text-amber-500"
              />
            </StatGrid>
          ) : (
            <StatGrid>
              <StatCard
                variant="compact"
                title="Total"
                value={stats.total}
                icon={CalendarCheck2}
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-500"
              />
              <StatCard
                variant="compact"
                title="Approved"
                value={stats.approved}
                icon={CheckCircle2}
                iconBgColor="bg-emerald-500/10"
                iconColor="text-emerald-500"
              />
              <StatCard
                variant="compact"
                title="Pending"
                value={stats.pending}
                icon={Clock}
                iconBgColor="bg-amber-500/10"
                iconColor="text-amber-500"
              />
            </StatGrid>
          )
        }
        tabs={dynamicTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {activeTab === "calendar" ? (
          <LeaveCalendarView
            apiBasePath={normalizedApiBasePath}
            onStatsChange={setCalendarStats}
            onSelectLeave={(leave) => {
              setSelectedLeaveDetail(leave)
              setDetailDialogOpen(true)
            }}
          />
        ) : (
          <DataTable<LeaveItem>
            data={activeData}
            columns={columns}
            getRowId={(r) => r.id}
            pagination={{ pageSize: 50 }}
            isLoading={isLoading}
            error={error instanceof Error ? error.message : null}
            onRetry={refetch}
            searchPlaceholder="Search employee name or leave type..."
            searchFn={(r, q) => `${r.user?.full_name} ${r.leave_type?.name} ${r.status}`.toLowerCase().includes(q)}
            filters={filters}
            rowActions={[
              {
                label: "View Detail",
                icon: Eye,
                onClick: (r) => {
                  setSelectedLeaveDetail(r)
                  setDetailDialogOpen(true)
                },
              },
              {
                label: "Endorse",
                icon: Check,
                hidden: (r) => !myQueueIds.has(r.id),
                onClick: (r) => handleAction(r.id, "approve"),
              },
              {
                label: "Reject",
                icon: X,
                variant: "destructive",
                hidden: (r) => !myQueueIds.has(r.id),
                onClick: (r) => handleAction(r.id, "reject"),
              },
            ]}
            expandable={{
              render: (r) => (
                <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                  <div className="space-y-3">
                    <SectionHeading
                      title="Leave overview"
                      aside={
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => {
                            setSelectedLeaveDetail(r)
                            setDetailDialogOpen(true)
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Open details
                        </Button>
                      }
                    />
                    <LeaveStatusStrip leave={r} />
                    <LeaveOverlapNotice leave={r} />
                    <LeaveDetailsList leave={r} />
                  </div>

                  <div className="space-y-5">
                    <LeaveApprovalStages leave={r} />
                    <LeaveAttachments leave={r} />
                  </div>

                  {myQueueIds.has(r.id) && (
                    <div className="flex gap-2 border-t pt-3 md:col-span-2">
                      <Button onClick={() => handleAction(r.id, "approve")} className="gap-2">
                        <Check className="h-4 w-4" /> Endorse
                      </Button>
                      <Button variant="destructive" onClick={() => handleAction(r.id, "reject")} className="gap-2">
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ),
            }}
            viewToggle
            contactsView
            stickyToolbar
            defaultViewMode={{ mobile: "contacts", desktop: "list" }}
            mobileRow={{
              leading: (r) => (
                <StaffAvatar
                  name={r.user?.full_name || "Employee"}
                  src={staffAvatars[r.user_id]}
                  className="h-10 w-10 text-sm"
                />
              ),
              title: (r) => r.user?.full_name || "Employee",
              subtitle: (r) => `${r.leave_type?.name || "—"} · ${r.start_date} to ${r.end_date} (${r.days_count}d)`,
              trailing: (r) => (
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={
                      r.status === "approved" || r.status === "completed"
                        ? "default"
                        : r.status === "rejected" || r.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {r.status}
                  </Badge>
                </div>
              ),
              detail: {
                title: (r) => r.user?.full_name || "Employee",
                subtitle: (r) => r.leave_type?.name || "—",
                avatar: (r) => (
                  <StaffAvatar
                    name={r.user?.full_name || "Employee"}
                    src={staffAvatars[r.user_id]}
                    profileId={r.user_id}
                    size="xl"
                    className="text-xl"
                  />
                ),
                badges: (r) => (
                  <Badge
                    variant={
                      r.status === "approved" || r.status === "completed"
                        ? "default"
                        : r.status === "rejected" || r.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {r.status}
                  </Badge>
                ),
                fields: (r) => [
                  {
                    icon: User,
                    label: "Employee",
                    value: r.user?.full_name || "—",
                    fullWidth: true,
                  },
                  {
                    icon: Mail,
                    label: "Email",
                    value: r.user?.company_email || "—",
                    fullWidth: true,
                    copyable: Boolean(r.user?.company_email),
                  },
                  {
                    icon: Building2,
                    label: "Department",
                    value: r.user?.department || "—",
                  },
                  {
                    icon: CalendarDays,
                    label: "Leave Type",
                    value: r.leave_type?.name || "—",
                  },
                  {
                    icon: CalendarDays,
                    label: "Period",
                    value: `${r.start_date} to ${r.end_date}`,
                  },
                  {
                    icon: Clock,
                    label: "Duration",
                    value: `${r.days_count} day${Number(r.days_count) > 1 ? "s" : ""}`,
                  },
                  {
                    icon: FileText,
                    label: "Reason",
                    value: r.reason || "—",
                    fullWidth: true,
                  },
                ],
                actions: (r) => [
                  {
                    label: "View Full Detail",
                    onClick: () => {
                      setSelectedLeaveDetail(r)
                      setDetailDialogOpen(true)
                    },
                  },
                ],
              },
            }}
            cardRenderer={(r) => (
              <div className="bg-card space-y-4 rounded-xl border p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">{r.user?.full_name}</h4>
                    <p className="text-muted-foreground text-xs">{r.leave_type?.name}</p>
                  </div>
                  <Badge variant={r.status === "approved" || r.status === "completed" ? "default" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>

                <div className="text-muted-foreground space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {r.start_date} to {r.end_date} ({r.days_count} days)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {STAGE_LABELS[r.current_stage_code || r.approval_stage] || r.current_stage_code}
                    </Badge>
                  </div>
                </div>

                {activeTab === "my-actions" && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1" onClick={() => handleAction(r.id, "approve")}>
                      Endorse
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleAction(r.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
            urlSync
          />
        )}
      </DataTablePage>
    </>
  )
}
