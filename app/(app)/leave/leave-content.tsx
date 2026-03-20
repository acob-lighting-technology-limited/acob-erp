"use client"

import { useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { ItemInfoButton } from "@/components/ui/item-info-button"
import { PageHeader, PageWrapper } from "@/components/layout"
import { toast } from "sonner"
import { CalendarDays, Clock, Plus } from "lucide-react"
import type { LeaveBalance, LeaveRequest, LeaveType } from "./page"

import { LeaveTypesCard } from "@/components/leave/leave-types-card"
import { ApprovalQueueCard } from "@/components/leave/approval-queue-card"
import { LeaveRequestsCard } from "@/components/leave/leave-requests-card"
import { LeaveDeleteConfirmDialog } from "@/components/leave/leave-delete-confirm-dialog"
import { LeaveRequestFormDialog } from "@/components/leave/leave-request-form-dialog"
import { LeaveRejectPromptDialog, LeaveEvidencePromptDialog } from "@/components/leave/leave-prompt-dialogs"
import { fetchLeaveData, addDays, getTodayLocalIsoDate } from "@/components/leave/leave-data"

interface LeaveContentProps {
  currentUserId: string
  initialRequests: LeaveRequest[]
  initialBalances: LeaveBalance[]
  initialLeaveTypes: LeaveType[]
}

const EMPTY_REQUEST_FORM = {
  leave_type_id: "",
  start_date: "",
  days_count: 1,
  reason: "",
  reliever_identifier: "",
  handover_note: "",
}

export function LeaveContent({
  currentUserId,
  initialRequests,
  initialBalances,
  initialLeaveTypes,
}: LeaveContentProps) {
  const queryClient = useQueryClient()

  const { data: leaveData } = useQuery({
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

  const requests = leaveData.requests
  const balances = leaveData.balances
  const leaveTypes = leaveData.leaveTypes
  const approverQueue = leaveData.approverQueue
  const relieverOptions = leaveData.relieverOptions

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingEvidenceFor, setUploadingEvidenceFor] = useState<string | null>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null)
  const [requestsTab, setRequestsTab] = useState<"ongoing" | "history">("ongoing")
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected" | "cancelled">("all")
  const [rejectPrompt, setRejectPrompt] = useState<{ requestId: string } | null>(null)
  const [evidencePrompt, setEvidencePrompt] = useState<{ requestId: string; documentType: string } | null>(null)
  const [deleteConfirmRequest, setDeleteConfirmRequest] = useState<LeaveRequest | null>(null)
  const approvalQueueRef = useRef<HTMLDivElement | null>(null)
  const [formData, setFormData] = useState(EMPTY_REQUEST_FORM)
  const todayIsoDate = useMemo(() => getTodayLocalIsoDate(), [])

  const myRequests = useMemo(
    () => requests.filter((request) => request.user_id === currentUserId),
    [requests, currentUserId]
  )
  const ongoingRequests = useMemo(
    () =>
      myRequests.filter((request) => {
        if (request.status === "rejected" || request.status === "cancelled") return false
        if (request.status !== "approved") return true
        return !request.end_date || request.end_date >= todayIsoDate
      }),
    [myRequests, todayIsoDate]
  )
  const historyRequests = useMemo(
    () =>
      myRequests.filter((request) => {
        if (request.status === "rejected" || request.status === "cancelled") return true
        if (request.status !== "approved") return false
        return Boolean(request.end_date && request.end_date < todayIsoDate)
      }),
    [myRequests, todayIsoDate]
  )
  const filteredHistoryRequests = useMemo(() => {
    if (historyFilter === "all") return historyRequests
    return historyRequests.filter((request) => request.status === historyFilter)
  }, [historyFilter, historyRequests])

  const hasPendingRequest = myRequests.some((request) => ["pending", "pending_evidence"].includes(request.status))
  const leaveTypeMap = useMemo(() => new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType])), [leaveTypes])
  const balanceMap = useMemo(() => new Map(balances.map((balance) => [balance.leave_type_id, balance])), [balances])

  const preview = useMemo(
    () => addDays(formData.start_date, Number(formData.days_count)),
    [formData.start_date, formData.days_count]
  )

  const selectedLeaveType = useMemo(
    () => leaveTypeMap.get(formData.leave_type_id),
    [leaveTypeMap, formData.leave_type_id]
  )
  const selectedBalance = useMemo(() => balanceMap.get(formData.leave_type_id), [balanceMap, formData.leave_type_id])
  const availableDays = selectedBalance?.balance_days ?? selectedLeaveType?.max_days ?? 0

  const canSubmit =
    formData.leave_type_id &&
    formData.start_date &&
    Number(formData.days_count) > 0 &&
    formData.reason.trim().length >= 10 &&
    formData.handover_note.trim().length >= 10 &&
    formData.reliever_identifier.trim().length > 0 &&
    selectedLeaveType?.eligibility_status !== "not_eligible" &&
    Number(formData.days_count) <= availableDays
  const pendingMyReviews = useMemo(() => approverQueue.length, [approverQueue])

  function isRequesterEditable(request: LeaveRequest) {
    if (request.user_id !== currentUserId) return false
    const stage = request.current_stage_code || request.approval_stage
    return ["pending", "pending_evidence"].includes(request.status) && stage === "pending_reliever"
  }

  function resetRequestForm() {
    setEditingRequestId(null)
    setFormData(EMPTY_REQUEST_FORM)
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetRequestForm()
    }
  }

  function openCreateDialog() {
    resetRequestForm()
    setOpen(true)
  }

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

  function invalidateLeaveData() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests({ userId: currentUserId }) })
  }

  async function handleSubmitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const isEditing = Boolean(editingRequestId)
      const response = await fetch("/api/hr/leave/requests", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: editingRequestId, ...formData } : formData),
      })

      const payload = await response.json()
      if (!response.ok)
        throw new Error(
          payload.error || (isEditing ? "Failed to update leave request" : "Failed to submit leave request")
        )

      toast.success(
        payload.message || (isEditing ? "Leave request updated successfully" : "Leave request submitted successfully")
      )
      setOpen(false)
      resetRequestForm()
      invalidateLeaveData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function executeDeleteRequest(request: LeaveRequest) {
    setDeleteConfirmRequest(null)
    setDeletingRequestId(request.id)
    try {
      const response = await fetch(`/api/hr/leave/requests?id=${encodeURIComponent(request.id)}`, {
        method: "DELETE",
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to delete leave request")

      toast.success(payload.message || "Leave request deleted successfully")
      invalidateLeaveData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete leave request")
    } finally {
      setDeletingRequestId(null)
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
      if (!response.ok) throw new Error(payload.error || "Failed to process action")
      toast.success(payload.message || "Action completed")
      invalidateLeaveData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process action")
    }
  }

  function handleAction(requestId: string, action: "approve" | "reject") {
    if (action === "reject") {
      setRejectPrompt({ requestId })
    } else {
      submitAction(requestId, "approve", "")
    }
  }

  async function submitEvidence(requestId: string, documentType: string, fileUrl: string) {
    setUploadingEvidenceFor(requestId)
    try {
      const response = await fetch("/api/hr/leave/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leave_request_id: requestId, document_type: documentType, file_url: fileUrl }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to upload evidence")
      toast.success(payload.message || "Evidence uploaded")
      invalidateLeaveData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload evidence")
    } finally {
      setUploadingEvidenceFor(null)
    }
  }

  function handleUploadEvidence(requestId: string, documentType: string) {
    setEvidencePrompt({ requestId, documentType })
  }

  return (
    <>
      <LeaveDeleteConfirmDialog
        request={deleteConfirmRequest}
        onOpenChange={() => setDeleteConfirmRequest(null)}
        onConfirm={executeDeleteRequest}
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

      <PageWrapper maxWidth="full" background="gradient">
        <PageHeader
          title="Leave Management"
          description="All leave types are visible with explicit eligibility and evidence rules."
          icon={CalendarDays}
          backLink={{ href: "/profile", label: "Back to Dashboard" }}
          actions={
            <>
              <ItemInfoButton
                title="Leave page guide"
                summary="This page helps you understand leave eligibility, your own requests, and any approvals waiting on you."
                details={[
                  {
                    label: "What each area does",
                    value:
                      "Leave Types explains what you can apply for, My Leave Requests tracks your submissions, and Pending Reviews appears when someone else's leave needs your decision.",
                  },
                  {
                    label: "Where to start",
                    value:
                      "Check Leave Types and Balances first, then create a new request with a clear reason, reliever, and handover note.",
                  },
                  {
                    label: "What happens after submission",
                    value:
                      "Your request moves through the approval workflow and may pause if evidence is missing or if an approver needs a clearer handover.",
                  },
                ]}
              />
              {pendingMyReviews > 0 && (
                <Button
                  variant="outline"
                  onClick={() => approvalQueueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  Pending Reviews ({pendingMyReviews})
                </Button>
              )}
              <Button onClick={openCreateDialog} disabled={hasPendingRequest}>
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </>
          }
        />

        <LeaveTypesCard leaveTypes={leaveTypes} balanceMap={balanceMap} />

        <ApprovalQueueCard ref={approvalQueueRef} approverQueue={approverQueue} onAction={handleAction} />

        <LeaveRequestsCard
          ongoingRequests={ongoingRequests}
          historyRequests={historyRequests}
          filteredHistoryRequests={filteredHistoryRequests}
          requestsTab={requestsTab}
          setRequestsTab={setRequestsTab}
          historyFilter={historyFilter}
          setHistoryFilter={setHistoryFilter}
          uploadingEvidenceFor={uploadingEvidenceFor}
          deletingRequestId={deletingRequestId}
          isRequesterEditable={isRequesterEditable}
          onEdit={openEditDialog}
          onDeleteRequest={setDeleteConfirmRequest}
          onUploadEvidence={handleUploadEvidence}
        />

        <LeaveRequestFormDialog
          open={open}
          onOpenChange={handleDialogOpenChange}
          editingRequestId={editingRequestId}
          formData={formData}
          setFormData={setFormData}
          leaveTypes={leaveTypes}
          relieverOptions={relieverOptions}
          selectedLeaveType={selectedLeaveType}
          selectedBalance={selectedBalance}
          availableDays={availableDays}
          preview={preview}
          canSubmit={!!canSubmit}
          submitting={submitting}
          onSubmit={handleSubmitRequest}
        />

        {hasPendingRequest && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            You currently have an active leave request in workflow.
          </div>
        )}
      </PageWrapper>
    </>
  )
}
