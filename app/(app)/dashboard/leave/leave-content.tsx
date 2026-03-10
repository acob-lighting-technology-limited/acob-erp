"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader, PageWrapper } from "@/components/layout"
import { toast } from "sonner"
import { CalendarDays, ChevronDown, ChevronRight, Clock, Eye, Plus, Upload } from "lucide-react"
import type { LeaveApprovalAudit, LeaveBalance, LeaveRequest, LeaveType } from "./page"

interface LeaveContentProps {
  currentUserId: string
  currentUserRole: string
  initialRequests: LeaveRequest[]
  initialBalances: LeaveBalance[]
  initialLeaveTypes: LeaveType[]
}

interface ApprovalHistoryItem extends LeaveApprovalAudit {
  leave_request_id: string
  request?: LeaveRequest | null
}

const STAGE_LABELS: Record<string, string> = {
  pending_reliever: "Waiting Reliever",
  pending_department_lead: "Waiting Department Lead",
  pending_admin_hr_lead: "Waiting Admin & HR Lead",
  pending_md: "Waiting MD",
  pending_hcs: "Waiting HCS",
  reliever_pending: "Waiting Reliever",
  supervisor_pending: "Waiting Department Lead",
  hr_pending: "Waiting Admin & HR Lead",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

const ELIGIBILITY_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  eligible: "default",
  missing_evidence: "secondary",
  not_eligible: "destructive",
}

const ADMIN_LIKE_ROLES = ["developer", "admin", "super_admin"]

function addDays(startDate: string, days: number) {
  if (!startDate || days <= 0) return { endDate: "", resumeDate: "" }
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + days - 1)
  const resume = new Date(end)
  resume.setUTCDate(resume.getUTCDate() + 1)

  return {
    endDate: end.toISOString().slice(0, 10),
    resumeDate: resume.toISOString().slice(0, 10),
  }
}

function prettyEligibility(status: string) {
  if (status === "eligible") return "Eligible"
  if (status === "missing_evidence") return "Missing Evidence"
  return "Not Eligible"
}

function prettyDocName(name: string) {
  return name.replaceAll("_", " ")
}

function clampDays(nextValue: number, maxDays?: number | null) {
  const normalized = Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 1
  if (maxDays && maxDays > 0) {
    return Math.min(normalized, maxDays)
  }
  return normalized
}

function formatStage(stage?: string | null) {
  if (!stage) return "Unknown Stage"
  return STAGE_LABELS[stage] || stage.replaceAll("_", " ")
}

function formatApprovalStatus(status?: string | null) {
  if (!status) return "Unknown"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDateLabel(isoDate?: string | null) {
  if (!isoDate) return "-"
  const dt = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return isoDate
  return dt.toLocaleDateString()
}

function calculateInclusiveDays(start?: string | null, end?: string | null, fallback = 0) {
  if (!start || !end) return fallback
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime()
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return fallback
  return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1
}

function daysUntil(isoDate?: string | null) {
  if (!isoDate) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetDate = new Date(`${isoDate}T00:00:00`).getTime()
  if (Number.isNaN(targetDate)) return null
  return Math.ceil((targetDate - today) / (24 * 60 * 60 * 1000))
}

function sortApprovals(approvals?: LeaveApprovalAudit[]) {
  return [...(approvals || [])].sort((left, right) => {
    const leftOrder = left.stage_order ?? left.approval_level ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.stage_order ?? right.approval_level ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    const leftTime = left.approved_at ? new Date(left.approved_at).getTime() : 0
    const rightTime = right.approved_at ? new Date(right.approved_at).getTime() : 0
    return leftTime - rightTime
  })
}

function getTodayLocalIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
  currentUserRole,
  initialRequests,
  initialBalances,
  initialLeaveTypes,
}: LeaveContentProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
  const [balances, setBalances] = useState<LeaveBalance[]>(initialBalances)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(initialLeaveTypes)
  const [approverQueue, setApproverQueue] = useState<LeaveRequest[]>([])
  const [relieverCommitments, setRelieverCommitments] = useState<LeaveRequest[]>([])
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([])
  const [relieverOptions, setRelieverOptions] = useState<{ value: string; label: string }[]>([])
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingEvidenceFor, setUploadingEvidenceFor] = useState<string | null>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null)
  const [showLeavePolicy, setShowLeavePolicy] = useState(false)
  const [requestsTab, setRequestsTab] = useState<"ongoing" | "history">("ongoing")
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected" | "cancelled">("all")
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null)
  const approvalQueueRef = useRef<HTMLDivElement | null>(null)
  const [formData, setFormData] = useState(EMPTY_REQUEST_FORM)
  const todayIsoDate = useMemo(() => getTodayLocalIsoDate(), [])
  const isAdminLikeViewer = useMemo(() => ADMIN_LIKE_ROLES.includes(currentUserRole || ""), [currentUserRole])

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
  const activeApprovedRequest = myRequests.find(
    (request) => request.status === "approved" && (!request.end_date || request.end_date >= todayIsoDate)
  )
  const hasBlockingRequest = hasPendingRequest || Boolean(activeApprovedRequest)
  const activeRelieverCommitments = useMemo(
    () =>
      relieverCommitments.filter((request) => {
        if (request.status === "rejected" || request.status === "cancelled") return false
        return !request.end_date || request.end_date >= todayIsoDate
      }),
    [relieverCommitments, todayIsoDate]
  )
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
  const availableDays = Math.max(1, selectedBalance?.balance_days ?? selectedLeaveType?.max_days ?? 1)
  const detailApprovals = useMemo(() => sortApprovals(detailRequest?.approvals), [detailRequest])

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
  const relieverApprovalHistory = useMemo(
    () =>
      approvalHistory.filter((item) =>
        ["pending_reliever", "reliever_pending"].includes(String(item.stage_code || ""))
      ),
    [approvalHistory]
  )
  const nonRelieverApprovalHistory = useMemo(
    () =>
      approvalHistory.filter(
        (item) => !["pending_reliever", "reliever_pending"].includes(String(item.stage_code || ""))
      ),
    [approvalHistory]
  )
  const departmentApprovalHistory = useMemo(
    () =>
      nonRelieverApprovalHistory.filter((item) =>
        ["pending_department_lead", "supervisor_pending"].includes(String(item.stage_code || ""))
      ),
    [nonRelieverApprovalHistory]
  )
  const globalLeadApprovalHistory = useMemo(
    () =>
      nonRelieverApprovalHistory.filter(
        (item) => !["pending_department_lead", "supervisor_pending"].includes(String(item.stage_code || ""))
      ),
    [nonRelieverApprovalHistory]
  )

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      days_count: clampDays(Number(prev.days_count), availableDays),
    }))
  }, [availableDays, selectedLeaveType?.id, selectedBalance?.balance_days])

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
      days_count: clampDays(
        Number(request.days_count) || 1,
        balanceMap.get(request.leave_type_id)?.balance_days ?? leaveTypeMap.get(request.leave_type_id)?.max_days
      ),
      reason: request.reason || "",
      reliever_identifier: request.reliever_id || "",
      handover_note: request.handover_note || "",
    })
    setOpen(true)
  }

  async function refreshData() {
    const queueUrl = isAdminLikeViewer ? "/api/hr/leave/queue?all=true" : "/api/hr/leave/queue"
    const [requestRes, queueRes, typesRes, relieversRes] = await Promise.all([
      fetch("/api/hr/leave/requests"),
      fetch(queueUrl),
      fetch("/api/hr/leave/types"),
      fetch("/api/hr/leave/relievers"),
    ])

    const [requestPayload, queuePayload, typesPayload, relieversPayload] = await Promise.all([
      requestRes.json().catch(() => ({})),
      queueRes.json().catch(() => ({})),
      typesRes.json().catch(() => ({})),
      relieversRes.json().catch(() => ({})),
    ])

    const errors: string[] = []

    if (requestRes.ok) {
      const ownedRequests = (requestPayload.data || []).filter((row: LeaveRequest) => row.user_id === currentUserId)
      setRequests(ownedRequests)
      setBalances(requestPayload.balances || [])
      setRelieverCommitments(requestPayload.reliever_commitments || [])
    } else {
      errors.push(`requests: ${requestPayload.error || requestRes.statusText}`)
    }

    if (queueRes.ok) {
      setApproverQueue(queuePayload.data || [])
      setApprovalHistory(queuePayload.history || [])
    } else {
      errors.push(`queue: ${queuePayload.error || queueRes.statusText}`)
    }

    if (typesRes.ok) {
      setLeaveTypes(typesPayload.data || [])
    } else {
      errors.push(`types: ${typesPayload.error || typesRes.statusText}`)
    }

    if (relieversRes.ok) {
      setRelieverOptions(relieversPayload.data || [])
    } else {
      errors.push(`relievers: ${relieversPayload.error || relieversRes.statusText}`)
    }

    if (errors.length > 0) {
      throw new Error(`Leave data partial failure -> ${errors.join(" | ")}`)
    }
  }

  useEffect(() => {
    refreshData().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load leave data")
    })
  }, [isAdminLikeViewer])

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
      await refreshData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteRequest(request: LeaveRequest) {
    if (!isRequesterEditable(request)) return
    if (!window.confirm("Delete this leave request before reliever approval?")) return

    setDeletingRequestId(request.id)
    try {
      const response = await fetch(`/api/hr/leave/requests?id=${encodeURIComponent(request.id)}`, {
        method: "DELETE",
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to delete leave request")

      toast.success(payload.message || "Leave request deleted successfully")
      await refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete leave request")
    } finally {
      setDeletingRequestId(null)
    }
  }

  async function handleAction(requestId: string, action: "approve" | "reject") {
    const comments = action === "reject" ? window.prompt("Reason for rejection") || "" : ""
    if (action === "reject" && !comments.trim()) {
      toast.error("Rejection reason is required")
      return
    }

    try {
      const response = await fetch("/api/hr/leave/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_request_id: requestId,
          action,
          comments,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to process action")

      toast.success(payload.message || "Action completed")
      await refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process action")
    }
  }

  async function handleUploadEvidence(requestId: string, documentType: string) {
    const fileUrl = window.prompt(`Enter URL for ${prettyDocName(documentType)}:`)?.trim()
    if (!fileUrl) return

    setUploadingEvidenceFor(requestId)
    try {
      const response = await fetch("/api/hr/leave/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_request_id: requestId,
          document_type: documentType,
          file_url: fileUrl,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to upload evidence")
      toast.success(payload.message || "Evidence uploaded")
      await refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload evidence")
    } finally {
      setUploadingEvidenceFor(null)
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Leave Management"
        description="All leave types are visible with explicit eligibility and evidence rules."
        icon={CalendarDays}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
        actions={
          <>
            {pendingMyReviews > 0 && (
              <Button
                variant="outline"
                onClick={() => approvalQueueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Pending Reviews ({pendingMyReviews})
              </Button>
            )}
            <Button onClick={openCreateDialog} disabled={hasBlockingRequest}>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Leave Types and Balances</CardTitle>
              <CardDescription>Professional governance: policy + evidence + transparent eligibility</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowLeavePolicy((prev) => !prev)}>
              {showLeavePolicy ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
              {showLeavePolicy ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>
        {showLeavePolicy && (
          <CardContent className="space-y-2">
            {leaveTypes.map((leaveType) => {
              const balance = balanceMap.get(leaveType.id)
              const allocatedDays = balance?.allocated_days ?? leaveType.max_days
              const usedDays = balance?.used_days ?? 0
              const leftDays = balance?.balance_days ?? leaveType.max_days

              return (
                <div key={leaveType.id} className="space-y-1 rounded-md border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{leaveType.name}</p>
                    <Badge variant={ELIGIBILITY_VARIANT[leaveType.eligibility_status] || "outline"}>
                      {prettyEligibility(leaveType.eligibility_status)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {usedDays} used / {allocatedDays} allocated | {leftDays} days left
                  </p>
                  {leaveType.eligibility_reason && (
                    <p className="text-muted-foreground text-xs">{leaveType.eligibility_reason}</p>
                  )}
                  {leaveType.required_documents?.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      Required documents: {leaveType.required_documents.map(prettyDocName).join(", ")}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        )}
      </Card>

      <Card ref={approvalQueueRef}>
        <CardHeader>
          <CardTitle>{isAdminLikeViewer ? "Active Leave Workflow Queue" : "My Approval Queue"}</CardTitle>
          <CardDescription>
            {isAdminLikeViewer
              ? "Showing all active leave approvals in the system so you can monitor test flows."
              : "Requests awaiting your action"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {approverQueue.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              No leave requests are currently waiting in this queue.
            </div>
          ) : (
            approverQueue.map((item) => (
              <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.leave_type?.name || "Leave Request"}</p>
                    <Badge variant="outline">{formatStage(item.current_stage_code || item.approval_stage)}</Badge>
                    {item.current_approver?.full_name && isAdminLikeViewer && (
                      <Badge variant="secondary">Assigned to {item.current_approver.full_name}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {formatDateLabel(item.start_date)} to {formatDateLabel(item.end_date)} ({item.days_count} days)
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Requester: {item.user?.full_name || item.user?.company_email || "Unknown"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Reliever: {item.reliever?.full_name || item.reliever?.company_email || "Not set"}
                  </p>
                  <p className="text-sm">Reason: {item.reason || "No reason provided"}</p>
                  {item.handover_note && (
                    <p className="text-muted-foreground text-sm">Handover: {item.handover_note}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDetailRequest(item)}>
                    <Eye className="mr-1 h-4 w-4" />
                    View
                  </Button>
                  <Button size="sm" onClick={() => handleAction(item.id, "approve")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleAction(item.id, "reject")}>
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Approval Activity</CardTitle>
          <CardDescription>
            Keep a visible trail of approvals, clearly separated by reliever actions and normal approver actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvalHistory.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              You have not acted on any leave requests yet.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Approved as Reliever ({relieverApprovalHistory.length})
                </div>
                {relieverApprovalHistory.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                    No reliever approvals yet.
                  </div>
                ) : (
                  relieverApprovalHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.request?.leave_type?.name || "Leave Request"}</p>
                          <Badge variant={item.status === "approved" ? "default" : "destructive"}>
                            {formatApprovalStatus(item.status)}
                          </Badge>
                          <Badge variant="secondary">Reliever Decision</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {item.request?.user?.full_name || item.request?.user?.company_email || "Requester unknown"}
                        </p>
                        <p className="text-muted-foreground text-sm">Stage: {formatStage(item.stage_code)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => item.request && setDetailRequest(item.request)}
                        disabled={!item.request}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Approved as Department Lead ({departmentApprovalHistory.length})
                </div>
                {departmentApprovalHistory.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                    No department-level approvals yet.
                  </div>
                ) : (
                  departmentApprovalHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.request?.leave_type?.name || "Leave Request"}</p>
                          <Badge variant={item.status === "approved" ? "default" : "destructive"}>
                            {formatApprovalStatus(item.status)}
                          </Badge>
                          <Badge variant="outline">Department Approval</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {item.request?.user?.full_name || item.request?.user?.company_email || "Requester unknown"}
                        </p>
                        <p className="text-muted-foreground text-sm">Stage: {formatStage(item.stage_code)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => item.request && setDetailRequest(item.request)}
                        disabled={!item.request}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Approved as Global Lead ({globalLeadApprovalHistory.length})
                </div>
                {globalLeadApprovalHistory.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                    No global-lead approvals yet.
                  </div>
                ) : (
                  globalLeadApprovalHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.request?.leave_type?.name || "Leave Request"}</p>
                          <Badge variant={item.status === "approved" ? "default" : "destructive"}>
                            {formatApprovalStatus(item.status)}
                          </Badge>
                          <Badge variant="outline">Global Approval</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {item.request?.user?.full_name || item.request?.user?.company_email || "Requester unknown"}
                        </p>
                        <p className="text-muted-foreground text-sm">Stage: {formatStage(item.stage_code)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => item.request && setDetailRequest(item.request)}
                        disabled={!item.request}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Leave Requests</CardTitle>
          <CardDescription>
            Only leave requests you personally submitted, with ongoing and history views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={requestsTab === "ongoing" ? "default" : "outline"}
              onClick={() => setRequestsTab("ongoing")}
            >
              Ongoing ({ongoingRequests.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={requestsTab === "history" ? "default" : "outline"}
              onClick={() => setRequestsTab("history")}
            >
              History ({historyRequests.length})
            </Button>
          </div>

          {requestsTab === "history" && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={historyFilter === "all" ? "secondary" : "outline"}
                onClick={() => setHistoryFilter("all")}
              >
                All
              </Button>
              <Button
                type="button"
                size="sm"
                variant={historyFilter === "approved" ? "secondary" : "outline"}
                onClick={() => setHistoryFilter("approved")}
              >
                Approved
              </Button>
              <Button
                type="button"
                size="sm"
                variant={historyFilter === "rejected" ? "secondary" : "outline"}
                onClick={() => setHistoryFilter("rejected")}
              >
                Rejected
              </Button>
              <Button
                type="button"
                size="sm"
                variant={historyFilter === "cancelled" ? "secondary" : "outline"}
                onClick={() => setHistoryFilter("cancelled")}
              >
                Cancelled
              </Button>
            </div>
          )}

          {(requestsTab === "ongoing" ? ongoingRequests : filteredHistoryRequests).length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              {requestsTab === "ongoing" ? "No ongoing requests." : "No history requests for this filter."}
            </div>
          ) : (
            (requestsTab === "ongoing" ? ongoingRequests : filteredHistoryRequests).map((request) => {
              const durationDays = calculateInclusiveDays(
                request.start_date,
                request.end_date,
                Number(request.days_count) || 0
              )
              const returnInDays = request.status === "approved" ? daysUntil(request.resume_date) : null
              return (
                <div key={request.id} className="rounded-md border p-3">
                  {request.status === "approved" && (
                    <div className="bg-muted/30 mb-2 rounded-md border px-2 py-1 text-xs">
                      Leave window: {formatDateLabel(request.start_date)} to {formatDateLabel(request.end_date)} (
                      {durationDays} day(s))
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{request.leave_type?.name || "Leave Request"}</p>
                    <div className="flex gap-2">
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {request.status}
                      </Badge>
                      <Badge variant="outline">
                        {formatStage(request.current_stage_code || request.approval_stage)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {formatDateLabel(request.start_date)} to {formatDateLabel(request.end_date)} | Resume:{" "}
                    {formatDateLabel(request.resume_date)} | {request.days_count} day(s)
                  </p>
                  {request.status === "approved" && returnInDays !== null && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {returnInDays > 0
                        ? `${returnInDays} day(s) until resume date`
                        : returnInDays === 0
                          ? "Resumes today"
                          : "Resume date has passed"}
                    </p>
                  )}
                  <p className="mt-2 text-sm">{request.reason}</p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Reliever: {request.reliever?.full_name || request.reliever?.company_email || "Not set"}
                  </p>
                  {(request.required_documents || []).length > 0 && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Required documents: {(request.required_documents || []).map(prettyDocName).join(", ")}
                    </p>
                  )}
                  {request.approvals?.length ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Approval history: {request.approvals.length} recorded update
                      {request.approvals.length > 1 ? "s" : ""}
                    </p>
                  ) : null}
                  {(request.missing_documents || []).length > 0 && (
                    <div className="mt-2 rounded-md border border-amber-500/50 bg-amber-50 p-2 text-xs text-amber-700">
                      <p>Missing evidence: {(request.missing_documents || []).map(prettyDocName).join(", ")}</p>
                      {request.status === "pending_evidence" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(request.missing_documents || []).map((doc) => (
                            <Button
                              key={`${request.id}-${doc}`}
                              size="sm"
                              variant="outline"
                              disabled={uploadingEvidenceFor === request.id}
                              onClick={() => handleUploadEvidence(request.id, doc)}
                            >
                              <Upload className="mr-1 h-3 w-3" />
                              Upload {prettyDocName(doc)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetailRequest(request)}>
                      <Eye className="mr-1 h-4 w-4" />
                      View Details
                    </Button>
                    {isRequesterEditable(request) && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(request)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteRequest(request)}
                          disabled={deletingRequestId === request.id}
                        >
                          {deletingRequestId === request.id ? "Deleting..." : "Delete"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Reliever Commitments</CardTitle>
          <CardDescription>
            Leave requests where you are assigned as reliever. Overlapping personal leave requests are blocked for these
            periods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeRelieverCommitments.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              No active reliever commitments right now.
            </div>
          ) : (
            activeRelieverCommitments.map((request) => (
              <div key={`reliever-${request.id}`} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{request.leave_type?.name || "Leave Request"}</p>
                  <Badge variant={request.status === "approved" ? "default" : "secondary"}>{request.status}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  Requester: {request.user?.full_name || request.user?.company_email || "Unknown"}
                </p>
                <p className="text-muted-foreground text-sm">
                  Commitment window: {formatDateLabel(request.start_date)} to {formatDateLabel(request.end_date)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detailRequest)} onOpenChange={(nextOpen) => !nextOpen && setDetailRequest(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[720px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Leave Request Details
            </DialogTitle>
            <DialogDescription>
              Full workflow view with requester details, handover, evidence requirements, and approval timeline.
            </DialogDescription>
          </DialogHeader>

          {detailRequest && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border p-3">
                <p className="font-medium">{detailRequest.leave_type?.name || "Leave Request"}</p>
                <p className="text-muted-foreground mt-1">
                  {formatDateLabel(detailRequest.start_date)} to {formatDateLabel(detailRequest.end_date)} | Resume:{" "}
                  {formatDateLabel(detailRequest.resume_date)}
                </p>
                <p className="text-muted-foreground">
                  Duration:{" "}
                  {calculateInclusiveDays(
                    detailRequest.start_date,
                    detailRequest.end_date,
                    Number(detailRequest.days_count) || 0
                  )}{" "}
                  day(s)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge
                    variant={
                      detailRequest.status === "approved"
                        ? "default"
                        : detailRequest.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {detailRequest.status}
                  </Badge>
                  <Badge variant="outline">
                    {formatStage(detailRequest.current_stage_code || detailRequest.approval_stage)}
                  </Badge>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <p className="font-medium">People</p>
                <p className="text-muted-foreground mt-1">
                  Requester: {detailRequest.user?.full_name || detailRequest.user?.company_email || "Unknown"}
                </p>
                <p className="text-muted-foreground">
                  Reliever: {detailRequest.reliever?.full_name || detailRequest.reliever?.company_email || "Not set"}
                </p>
                <p className="text-muted-foreground">
                  Current approver:{" "}
                  {detailRequest.current_approver?.full_name ||
                    detailRequest.current_approver?.company_email ||
                    "Not assigned"}
                </p>
              </div>

              <div className="rounded-md border p-3">
                <p className="font-medium">Reason</p>
                <p className="text-muted-foreground mt-1">{detailRequest.reason || "No reason provided"}</p>
                <p className="mt-3 font-medium">Handover Note</p>
                <p className="text-muted-foreground mt-1">
                  {detailRequest.handover_note || "No handover note provided"}
                </p>
              </div>

              {(detailRequest.required_documents || []).length > 0 && (
                <div className="rounded-md border p-3">
                  <p className="font-medium">Evidence Requirements</p>
                  <p className="text-muted-foreground mt-1">
                    Required: {(detailRequest.required_documents || []).map(prettyDocName).join(", ")}
                  </p>
                  {(detailRequest.missing_documents || []).length > 0 ? (
                    <p className="mt-1 text-amber-700">
                      Missing: {(detailRequest.missing_documents || []).map(prettyDocName).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-emerald-700">All required evidence is complete.</p>
                  )}
                </div>
              )}

              <div className="rounded-md border p-3">
                <p className="font-medium">Approval Timeline</p>
                {detailApprovals.length === 0 ? (
                  <p className="text-muted-foreground mt-1">No approval updates yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {detailApprovals.map((approval) => (
                      <div key={approval.id} className="rounded-md border px-2 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={approval.status === "approved" ? "default" : "destructive"}>
                            {formatApprovalStatus(approval.status)}
                          </Badge>
                          <Badge variant="outline">{formatStage(approval.stage_code)}</Badge>
                          <span className="text-muted-foreground text-xs">
                            {approval.approver?.full_name || approval.approver?.company_email || "Unknown approver"}
                          </span>
                        </div>
                        {approval.approved_at ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {new Date(approval.approved_at).toLocaleString()}
                          </p>
                        ) : null}
                        {approval.comments ? <p className="mt-1 text-xs">Comment: {approval.comments}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[560px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {editingRequestId ? "Edit Leave Request" : "Submit Leave Request"}
            </DialogTitle>
            <DialogDescription>
              Request flow: Reliever {"->"} Supervisor {"->"} HR. Changes are allowed only before reliever approval.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmitRequest}>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select
                value={formData.leave_type_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    leave_type_id: value,
                    days_count: clampDays(
                      Number(prev.days_count),
                      balanceMap.get(value)?.balance_days ?? leaveTypeMap.get(value)?.max_days
                    ),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((leaveType) => (
                    <SelectItem
                      key={leaveType.id}
                      value={leaveType.id}
                      disabled={leaveType.eligibility_status === "not_eligible"}
                    >
                      {leaveType.name} ({leaveType.max_days} days) - {prettyEligibility(leaveType.eligibility_status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Available balance: {availableDays} days</p>
              <p className="text-muted-foreground text-xs">
                You cannot request more than this leave balance or policy limit.
              </p>
              {selectedLeaveType?.eligibility_reason && (
                <p className="text-muted-foreground text-xs">{selectedLeaveType.eligibility_reason}</p>
              )}
              {selectedLeaveType?.required_documents?.length ? (
                <p className="text-muted-foreground text-xs">
                  Required documents: {selectedLeaveType.required_documents.map(prettyDocName).join(", ")}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(event) => setFormData((prev) => ({ ...prev, start_date: event.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="space-y-2">
                <Label>Number of Days</Label>
                <Input
                  type="number"
                  min={1}
                  max={availableDays}
                  value={formData.days_count}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      days_count: clampDays(Number(event.target.value || 1), availableDays),
                    }))
                  }
                />
                <p className="text-muted-foreground text-xs">Maximum allowed: {availableDays} day(s)</p>
              </div>
            </div>

            <div className="bg-muted/40 rounded-md border p-3 text-sm">
              <p>
                Computed End Date: <span className="font-medium">{preview.endDate || "-"}</span>
              </p>
              <p>
                Computed Resume Date: <span className="font-medium">{preview.resumeDate || "-"}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reliever</Label>
              <SearchableSelect
                value={formData.reliever_identifier}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, reliever_identifier: value }))}
                options={relieverOptions}
                placeholder="Select reliever"
                searchPlaceholder="Search employee..."
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                rows={3}
                value={formData.reason}
                onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="Provide leave reason"
              />
            </div>

            <div className="space-y-2">
              <Label>Handover Note</Label>
              <Textarea
                rows={3}
                value={formData.handover_note}
                onChange={(event) => setFormData((prev) => ({ ...prev, handover_note: event.target.value }))}
                placeholder="Summarize duties and handover details"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting
                  ? editingRequestId
                    ? "Saving..."
                    : "Submitting..."
                  : editingRequestId
                    ? "Save Changes"
                    : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {hasPendingRequest && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          You currently have an active leave request in workflow.
        </div>
      )}
      {!hasPendingRequest && activeApprovedRequest && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          You already have an approved leave running until {formatDateLabel(activeApprovedRequest.end_date)}. You can
          request another leave after it ends.
        </div>
      )}
    </PageWrapper>
  )
}
