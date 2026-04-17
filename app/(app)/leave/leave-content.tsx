"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CalendarDays, Clock, Plus, ExternalLink, Trash2, Pencil, Paperclip, CircleHelp } from "lucide-react"
import type { LeaveBalance, LeaveRequest, LeaveType } from "./page"

import { LeaveTypesCard } from "@/components/leave/leave-types-card"
import { LeaveDeleteConfirmDialog } from "@/components/leave/leave-delete-confirm-dialog"
import { LeaveRequestFormDialog } from "@/components/leave/leave-request-form-dialog"
import { LeaveRejectPromptDialog, LeaveEvidencePromptDialog } from "@/components/leave/leave-prompt-dialogs"
import { fetchLeaveData, addDays } from "@/components/leave/leave-data"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab, RowAction } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatName } from "@/lib/utils"

interface LeaveContentProps {
  currentUserId: string
  initialRequests: LeaveRequest[]
  initialBalances: LeaveBalance[]
  initialLeaveTypes: LeaveType[]
}

type ApproverQueueItem = LeaveRequest & {
  user?: {
    full_name?: string | null
  } | null
}

type LeaveQueryData = {
  requests: LeaveRequest[]
  balances: LeaveBalance[]
  approverQueue: ApproverQueueItem[]
  leaveTypes: LeaveType[]
  relieverOptions: { value: string; label: string }[]
}

const EMPTY_REQUEST_FORM = {
  leave_type_id: "",
  start_date: "",
  days_count: 1,
  reason: "",
  reliever_identifier: "",
  handover_note: "",
}

const TABS: DataTableTab[] = [
  { key: "my-requests", label: "My Requests", icon: Clock },
  { key: "approvals", label: "Pending Reviews", icon: Clock },
]

export function LeaveContent({
  currentUserId,
  initialRequests,
  initialBalances,
  initialLeaveTypes,
}: LeaveContentProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("my-requests")

  const { data: leaveData } = useQuery<LeaveQueryData>({
    queryKey: QUERY_KEYS.leaveRequests({ userId: currentUserId }),
    queryFn: () => fetchLeaveData(currentUserId),
    initialData: {
      requests: initialRequests,
      balances: initialBalances,
      approverQueue: [],
      leaveTypes: initialLeaveTypes,
      relieverOptions: [],
    },
  })

  const { requests, balances, leaveTypes, approverQueue, relieverOptions } = leaveData

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [rejectPrompt, setRejectPrompt] = useState<{ requestId: string } | null>(null)
  const [evidencePrompt, setEvidencePrompt] = useState<{ requestId: string; documentType: string } | null>(null)
  const [deleteConfirmRequest, setDeleteConfirmRequest] = useState<LeaveRequest | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [formData, setFormData] = useState(EMPTY_REQUEST_FORM)

  const myRequests = useMemo(
    () => requests.filter((request) => request.user_id === currentUserId),
    [requests, currentUserId]
  )

  const balanceMap = useMemo(() => new Map(balances.map((b) => [b.leave_type_id, b])), [balances])
  const leaveTypeMap = useMemo(() => new Map(leaveTypes.map((t) => [t.id, t])), [leaveTypes])

  const stats = useMemo(() => {
    const totalTaken = myRequests
      .filter((r) => r.status === "approved")
      .reduce((acc, r) => acc + (r.days_count || 0), 0)
    const pending = myRequests.filter((r) => ["pending", "pending_evidence"].includes(r.status)).length
    return {
      totalTaken,
      pending,
      availableBalances: balances.filter((b) => b.balance_days > 0).length,
      waitingReviews: approverQueue.length,
    }
  }, [myRequests, balances, approverQueue])

  const columns: DataTableColumn<LeaveRequest>[] = useMemo(
    () => [
      {
        key: "leave_type",
        label: "Type",
        sortable: true,
        accessor: (r) => leaveTypeMap.get(r.leave_type_id)?.name || "Leave",
      },
      {
        key: "period",
        label: "Period",
        accessor: (r) => `${r.start_date} to ${r.end_date}`,
        render: (r) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium">
              {r.start_date} to {r.end_date}
            </span>
            <span className="text-muted-foreground">{r.days_count} day(s)</span>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => (
          <Badge
            variant={
              r.status === "approved"
                ? "default"
                : ["rejected", "cancelled"].includes(r.status)
                  ? "destructive"
                  : "outline"
            }
            className="capitalize"
          >
            {formatName(r.status)}
          </Badge>
        ),
      },
      {
        key: "stage",
        label: "Current Stage",
        accessor: (r) => r.current_stage_code || r.approval_stage || "-",
        render: (r) => (
          <span className="text-muted-foreground text-xs">
            {formatName(r.current_stage_code || r.approval_stage || "-")}
          </span>
        ),
      },
    ],
    [leaveTypeMap]
  )

  const filters: DataTableFilter<LeaveRequest>[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "pending", label: "Pending" },
        { value: "pending_evidence", label: "Pending Evidence" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
    {
      key: "leave_type",
      label: "Leave Type",
      options: leaveTypes.map((leaveType) => ({
        value: leaveType.id,
        label: leaveType.name,
      })),
      mode: "custom",
      filterFn: (row, selected) => selected.includes(row.leave_type_id),
    },
  ]

  const approvalFilters: DataTableFilter<ApproverQueueItem>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        options: [
          { value: "pending", label: "Pending" },
          { value: "pending_evidence", label: "Pending Evidence" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ],
      },
      {
        key: "leave_type",
        label: "Leave Type",
        options: leaveTypes.map((leaveType) => ({
          value: leaveType.id,
          label: leaveType.name,
        })),
        mode: "custom",
        filterFn: (row, selected) => selected.includes(row.leave_type_id),
      },
    ],
    [leaveTypes]
  )

  const staticRowActions: RowAction<LeaveRequest>[] = [
    {
      label: "Edit",
      icon: Pencil,
      onClick: (item) => openEditDialog(item),
      hidden: (r) => {
        const isEditAllowed =
          ["pending", "pending_evidence"].includes(r.status) &&
          ["pending_reliever", "reliever_pending"].includes(r.current_stage_code || r.approval_stage || "")
        return !isEditAllowed
      },
    },
    {
      label: "Upload Evidence",
      icon: Paperclip,
      onClick: (item) => setEvidencePrompt({ requestId: item.id, documentType: "Sick Note" }),
      hidden: (r) => r.status !== "pending_evidence",
    },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: (item) => setDeleteConfirmRequest(item),
      hidden: (r) => !["pending", "pending_evidence"].includes(r.status),
    },
  ]

  function openEditDialog(request: LeaveRequest) {
    setEditingRequestId(request.id)
    setFormData({
      leave_type_id: request.leave_type_id,
      start_date: request.start_date,
      days_count: Number(request.days_count) || 1,
      reason: request.reason || "",
      reliever_identifier: request.reliever_id || "",
      handover_note: request.handover_note || "",
    })
    setOpen(true)
  }

  function openCreateDialog() {
    setEditingRequestId(null)
    setFormData(EMPTY_REQUEST_FORM)
    setOpen(true)
  }

  async function handleSubmitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const isEditing = !!editingRequestId
      const response = await fetch("/api/hr/leave/requests", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: editingRequestId, ...formData } : formData),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to submit request")
      toast.success(payload.message || "Request submitted")
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests({ userId: currentUserId }) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function executeDeleteRequest(request: LeaveRequest) {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/hr/leave/requests?id=${encodeURIComponent(request.id)}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Delete failed")
      queryClient.setQueryData<LeaveQueryData>(QUERY_KEYS.leaveRequests({ userId: currentUserId }), (previous) => {
        if (!previous) return previous
        return {
          ...previous,
          requests: previous.requests.filter((item) => item.id !== request.id),
          approverQueue: previous.approverQueue.filter((item) => item.id !== request.id),
        }
      })
      setDeleteConfirmRequest(null)
      toast.success(payload.message || "Leave request deleted")
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests({ userId: currentUserId }) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setIsDeleting(false)
    }
  }

  async function submitAction(requestId: string, action: "approve" | "reject", comments: string) {
    try {
      const response = await fetch("/api/hr/leave/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leave_request_id: requestId, action, comments }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Action failed")
      toast.success(payload.message || "Action recorded")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests({ userId: currentUserId }) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    }
  }

  async function submitEvidence(requestId: string, documentType: string, fileUrl: string) {
    try {
      const response = await fetch("/api/hr/leave/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leave_request_id: requestId, document_type: documentType, file_url: fileUrl }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Evidence upload failed")
      toast.success(payload.message || "Evidence added")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests({ userId: currentUserId }) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Evidence upload failed")
    }
  }

  const hasPendingRequest = myRequests.some((r) => ["pending", "pending_evidence"].includes(r.status))

  return (
    <DataTablePage
      title="My Leave Center"
      description="Track eligibility, submit requests, and manage approvals in one view."
      icon={CalendarDays}
      backLink={{ href: "/profile", label: "Back to Home" }}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      stats={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Taken (Days)"
            value={stats.totalTaken}
            icon={CalendarDays}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Ongoing Requests"
            value={stats.pending}
            icon={Clock}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            title="Available Balances"
            value={stats.availableBalances}
            icon={ExternalLink}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          {stats.waitingReviews > 0 && (
            <StatCard
              title="Need Your Review"
              value={stats.waitingReviews}
              icon={Plus}
              iconBgColor="bg-violet-500/10"
              iconColor="text-violet-500"
            />
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsOverviewOpen(true)}>
            <CircleHelp className="mr-2 h-4 w-4" />
            Overview
          </Button>
          <Button onClick={openCreateDialog} disabled={hasPendingRequest}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {activeTab === "my-requests" && (
          <DataTable<LeaveRequest>
            data={myRequests}
            columns={columns}
            getRowId={(r) => r.id}
            filters={filters}
            searchPlaceholder="Search reason or type..."
            searchFn={(r, q) => `${leaveTypeMap.get(r.leave_type_id)?.name} ${r.reason}`.toLowerCase().includes(q)}
            rowActions={staticRowActions}
            urlSync
          />
        )}

        {activeTab === "approvals" && (
          <DataTable<ApproverQueueItem>
            data={approverQueue}
            getRowId={(r) => r.id}
            columns={[
              {
                key: "requester",
                label: "Requester",
                accessor: (r) => r.user?.full_name || "Employee",
              },
              {
                key: "period",
                label: "Period",
                accessor: (r) => `${r.start_date} to ${r.end_date}`,
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge variant="outline">{r.status}</Badge>,
              },
            ]}
            filters={approvalFilters}
            searchPlaceholder="Search requester or leave period..."
            searchFn={(r, q) =>
              `${r.user?.full_name || ""} ${r.start_date} ${r.end_date} ${r.reason || ""}`.toLowerCase().includes(q)
            }
            rowActions={[
              {
                label: "Approve",
                onClick: (r) => submitAction(r.id, "approve", ""),
              },
              {
                label: "Reject",
                variant: "destructive",
                onClick: (r) => setRejectPrompt({ requestId: r.id }),
              },
            ]}
          />
        )}
      </div>

      <LeaveDeleteConfirmDialog
        request={deleteConfirmRequest}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteConfirmRequest(null)
          }
        }}
        onConfirm={executeDeleteRequest}
        isDeleting={isDeleting}
      />

      <LeaveRejectPromptDialog
        rejectPrompt={rejectPrompt}
        onOpenChange={() => setRejectPrompt(null)}
        onConfirm={(requestId, reason) => {
          submitAction(requestId, "reject", reason)
          setRejectPrompt(null)
        }}
      />

      <LeaveEvidencePromptDialog
        evidencePrompt={evidencePrompt}
        onOpenChange={() => setEvidencePrompt(null)}
        onConfirm={(requestId, documentType, url) => {
          submitEvidence(requestId, documentType, url)
          setEvidencePrompt(null)
        }}
      />

      <LeaveRequestFormDialog
        open={open}
        onOpenChange={setOpen}
        editingRequestId={editingRequestId}
        formData={formData}
        setFormData={setFormData}
        leaveTypes={leaveTypes}
        relieverOptions={relieverOptions}
        selectedLeaveType={leaveTypeMap.get(formData.leave_type_id)}
        selectedBalance={balanceMap.get(formData.leave_type_id)}
        availableDays={
          balanceMap.get(formData.leave_type_id)?.balance_days ??
          leaveTypeMap.get(formData.leave_type_id)?.max_days ??
          0
        }
        preview={addDays(formData.start_date, Number(formData.days_count))}
        canSubmit={!!formData.leave_type_id && !!formData.start_date && !!formData.reason}
        submitting={submitting}
        onSubmit={handleSubmitRequest}
      />

      <Dialog open={isOverviewOpen} onOpenChange={setIsOverviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Leave Overview</DialogTitle>
            <DialogDescription>
              Quick guide for leave balances, request flow, and what each leave type allows.
            </DialogDescription>
          </DialogHeader>
          <LeaveTypesCard leaveTypes={leaveTypes} balanceMap={balanceMap} />
        </DialogContent>
      </Dialog>
    </DataTablePage>
  )
}
