"use client"

import { useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader, PageWrapper } from "@/components/layout"
import { toast } from "sonner"
import { CalendarDays, ChevronDown, ChevronRight, Clock, Plus, Upload } from "lucide-react"
import type { LeaveBalance, LeaveRequest, LeaveType } from "./page"

async function fetchLeaveData(currentUserId: string) {
  const [requestRes, queueRes, typesRes, relieversRes] = await Promise.all([
    fetch("/api/hr/leave/requests"),
    fetch("/api/hr/leave/queue"),
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

  if (!requestRes.ok) errors.push(`requests: ${requestPayload.error || requestRes.statusText}`)
  if (!queueRes.ok) errors.push(`queue: ${queuePayload.error || queueRes.statusText}`)
  if (!typesRes.ok) errors.push(`types: ${typesPayload.error || typesRes.statusText}`)
  if (!relieversRes.ok) errors.push(`relievers: ${relieversPayload.error || relieversRes.statusText}`)

  if (errors.length > 0) throw new Error(`Leave data partial failure -> ${errors.join(" | ")}`)

  const ownedRequests = (requestPayload.data || []).filter((row: LeaveRequest) => row.user_id === currentUserId)

  return {
    requests: ownedRequests as LeaveRequest[],
    balances: (requestPayload.balances || []) as LeaveBalance[],
    approverQueue: (queuePayload.data || []) as LeaveRequest[],
    leaveTypes: (typesPayload.data || []) as LeaveType[],
    relieverOptions: (relieversPayload.data || []) as { value: string; label: string }[],
  }
}

interface LeaveContentProps {
  currentUserId: string
  initialRequests: LeaveRequest[]
  initialBalances: LeaveBalance[]
  initialLeaveTypes: LeaveType[]
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
  const [showLeavePolicy, setShowLeavePolicy] = useState(false)
  const [requestsTab, setRequestsTab] = useState<"ongoing" | "history">("ongoing")
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected" | "cancelled">("all")
  // Rejection reason dialog state
  const [rejectPrompt, setRejectPrompt] = useState<{ requestId: string } | null>(null)
  // Evidence URL dialog state
  const [evidencePrompt, setEvidencePrompt] = useState<{ requestId: string; documentType: string } | null>(null)
  // Delete confirm dialog state
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
      // Open modal to collect rejection reason
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
      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deleteConfirmRequest}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmRequest(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave request? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmRequest) executeDeleteRequest(deleteConfirmRequest)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection reason dialog */}
      <PromptDialog
        open={!!rejectPrompt}
        onOpenChange={(open) => {
          if (!open) setRejectPrompt(null)
        }}
        title="Rejection Reason"
        description="Please provide a reason for rejecting this leave request."
        label="Reason"
        placeholder="Enter rejection reason..."
        inputType="textarea"
        required
        confirmLabel="Reject Leave"
        confirmVariant="destructive"
        onConfirm={(reason) => {
          if (rejectPrompt) submitAction(rejectPrompt.requestId, "reject", reason)
          setRejectPrompt(null)
        }}
      />

      {/* Evidence URL dialog */}
      <PromptDialog
        open={!!evidencePrompt}
        onOpenChange={(open) => {
          if (!open) setEvidencePrompt(null)
        }}
        title={`Upload Evidence: ${evidencePrompt ? prettyDocName(evidencePrompt.documentType) : ""}`}
        description="Enter the URL of the uploaded document."
        label="Document URL"
        placeholder="https://..."
        inputType="url"
        required
        confirmLabel="Submit"
        onConfirm={(url) => {
          if (evidencePrompt) submitEvidence(evidencePrompt.requestId, evidencePrompt.documentType, url)
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

        {approverQueue.length > 0 && (
          <Card ref={approvalQueueRef}>
            <CardHeader>
              <CardTitle>My Approval Queue</CardTitle>
              <CardDescription>Requests awaiting your action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {approverQueue.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="font-medium">{item.leave_type?.name || "Leave Request"}</p>
                    <p className="text-muted-foreground text-sm">
                      {item.start_date} to {item.end_date} ({item.days_count} days)
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
                    <Badge variant="outline">
                      {STAGE_LABELS[item.current_stage_code || item.approval_stage] ||
                        item.current_stage_code ||
                        item.approval_stage}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAction(item.id, "approve")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(item.id, "reject")}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>My Leave Requests</CardTitle>
            <CardDescription>Track ongoing requests separately from completed history.</CardDescription>
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
              (requestsTab === "ongoing" ? ongoingRequests : filteredHistoryRequests).map((request) => (
                <div key={request.id} className="rounded-md border p-3">
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
                        {STAGE_LABELS[request.current_stage_code || request.approval_stage] ||
                          request.current_stage_code ||
                          request.approval_stage ||
                          "N/A"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {request.start_date} to {request.end_date} | Resume: {request.resume_date} | {request.days_count}{" "}
                    day(s)
                  </p>
                  <p className="mt-2 text-sm">{request.reason}</p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Reliever: {request.reliever?.full_name || request.reliever?.company_email || "Not set"}
                  </p>
                  {(request.required_documents || []).length > 0 && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Required documents: {(request.required_documents || []).map(prettyDocName).join(", ")}
                    </p>
                  )}
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
                  {isRequesterEditable(request) && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(request)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (isRequesterEditable(request)) setDeleteConfirmRequest(request)
                        }}
                        disabled={deletingRequestId === request.id}
                      >
                        {deletingRequestId === request.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

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
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, leave_type_id: value }))}
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
                    value={formData.days_count}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, days_count: Number(event.target.value || 1) }))
                    }
                  />
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
      </PageWrapper>
    </>
  )
}
