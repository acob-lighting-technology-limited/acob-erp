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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ListToolbar } from "@/components/ui/patterns"
import { PageHeader, PageWrapper } from "@/components/layout"
import { toast } from "sonner"
import { CalendarDays, ChevronDown, ChevronRight, Clock, Edit2, Eye, Plus, Trash2, Upload } from "lucide-react"
import type { LeaveApprovalAudit, LeaveBalance, LeaveRequest, LeaveType } from "./page"
import { PromptDialog } from "@/components/ui/prompt-dialog"

interface LeaveContentProps {
  currentUserId: string
  currentUserRole: string
  initialRequests: LeaveRequest[]
  initialBalances: LeaveBalance[]
  initialLeaveTypes: LeaveType[]
}

type LeaveTableTab = "my-requests" | "reliever-commitments"
type MyRequestStatusTab = "all" | "pending" | "approved" | "rejected" | "cancelled" | "other"

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

function getLeaveStatusBadgeVariant(status?: string | null): "default" | "destructive" | "secondary" | "outline" {
  if (!status) return "outline"
  if (status === "approved") return "default"
  if (status === "rejected" || status === "cancelled") return "destructive"
  if (status === "pending" || status === "pending_evidence") return "secondary"
  return "outline"
}

function getLeaveStageBadgeVariant(stage?: string | null): "default" | "destructive" | "secondary" | "outline" {
  if (!stage) return "outline"
  if (["completed"].includes(stage)) return "default"
  if (["rejected", "cancelled"].includes(stage)) return "destructive"
  if (
    [
      "pending_reliever",
      "reliever_pending",
      "pending_department_lead",
      "supervisor_pending",
      "pending_admin_hr_lead",
      "hr_pending",
    ].includes(stage)
  ) {
    return "secondary"
  }
  return "outline"
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
  currentUserRole: _currentUserRole,
  initialRequests,
  initialBalances,
  initialLeaveTypes,
}: LeaveContentProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
  const [balances, setBalances] = useState<LeaveBalance[]>(initialBalances)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(initialLeaveTypes)
  const [relieverCommitments, setRelieverCommitments] = useState<LeaveRequest[]>([])
  const [relieverOptions, setRelieverOptions] = useState<{ value: string; label: string }[]>([])
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingEvidenceFor, setUploadingEvidenceFor] = useState<string | null>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null)
  const [showLeavePolicy, setShowLeavePolicy] = useState(false)
  const [rejectPrompt, setRejectPrompt] = useState<{ open: boolean; requestId: string } | null>(null)
  const [evidencePrompt, setEvidencePrompt] = useState<{ open: boolean; requestId: string; documentType: string } | null>(null)
  const [requestsTab, setRequestsTab] = useState<"ongoing" | "history">("ongoing")
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected" | "cancelled">("all")
  const approvalQueueRef = useRef<HTMLDivElement | null>(null)
  const [requestStatusTab, setRequestStatusTab] = useState<MyRequestStatusTab>("all")
  const [requestStageFilter, setRequestStageFilter] = useState("all")
  const [requestsSearch, setRequestsSearch] = useState("")
  const [relieverTab, setRelieverTab] = useState<"active" | "all">("active")
  const [relieverSearch, setRelieverSearch] = useState("")
  const [leaveTableTab, setLeaveTableTab] = useState<LeaveTableTab>("my-requests")
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null)
  const [formData, setFormData] = useState(EMPTY_REQUEST_FORM)
  const todayIsoDate = useMemo(() => getTodayLocalIsoDate(), [])

  const myRequests = useMemo(
    () => requests.filter((request) => request.user_id === currentUserId),
    [requests, currentUserId]
  )
  const hasPendingRequest = myRequests.some((request) => ["pending", "pending_evidence"].includes(request.status))
  const activeApprovedRequest = myRequests.find(
    (request) =>
      request.status === "approved" &&
      (!request.start_date || request.start_date <= todayIsoDate) &&
      (!request.end_date || request.end_date >= todayIsoDate)
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
  const detailLeadApprover = useMemo(
    () =>
      [...detailApprovals]
        .reverse()
        .find((approval) =>
          ["pending_department_lead", "supervisor_pending"].includes(String(approval.stage_code || ""))
        ),
    [detailApprovals]
  )
  const detailHrApprover = useMemo(
    () =>
      [...detailApprovals]
        .reverse()
        .find((approval) => ["pending_admin_hr_lead", "hr_pending"].includes(String(approval.stage_code || ""))),
    [detailApprovals]
  )

  const canSubmit =
    formData.leave_type_id &&
    formData.start_date &&
    Number(formData.days_count) > 0 &&
    formData.reason.trim().length >= 10 &&
    formData.handover_note.trim().length >= 10 &&
    formData.reliever_identifier.trim().length > 0 &&
    selectedLeaveType?.eligibility_status !== "not_eligible" &&
    Number(formData.days_count) <= availableDays
  const visibleLeaveTabs = useMemo(
    () =>
      [
        { key: "my-requests" as LeaveTableTab, label: "My Requests" },
        { key: "reliever-commitments" as LeaveTableTab, label: "Reliever Commitments" },
      ] as Array<{ key: LeaveTableTab; label: string }>,
    []
  )

  const requestStatusCounts = useMemo(() => {
    const known = new Set(["pending", "pending_evidence", "approved", "rejected", "cancelled"])
    return {
      all: myRequests.length,
      pending: myRequests.filter((request) => ["pending", "pending_evidence"].includes(request.status)).length,
      approved: myRequests.filter((request) => request.status === "approved").length,
      rejected: myRequests.filter((request) => request.status === "rejected").length,
      cancelled: myRequests.filter((request) => request.status === "cancelled").length,
      other: myRequests.filter((request) => !known.has(request.status)).length,
    }
  }, [myRequests])

  const myRequestRows = useMemo(() => {
    const source = myRequests.filter((request) => {
      if (requestStatusTab === "all") return true
      if (requestStatusTab === "pending") return ["pending", "pending_evidence"].includes(request.status)
      if (requestStatusTab === "other") {
        return !["pending", "pending_evidence", "approved", "rejected", "cancelled"].includes(request.status)
      }
      return request.status === requestStatusTab
    })

    const query = requestsSearch.trim().toLowerCase()
    const stageFiltered =
      requestStageFilter === "all"
        ? source
        : source.filter(
            (request) => (request.current_stage_code || request.approval_stage || "") === requestStageFilter
          )
    if (!query) return stageFiltered

    return stageFiltered.filter((request) => {
      const leaveName = request.leave_type?.name || "Leave Request"
      const relieverName = request.reliever?.full_name || request.reliever?.company_email || ""
      return (
        leaveName.toLowerCase().includes(query) ||
        String(request.reason || "")
          .toLowerCase()
          .includes(query) ||
        relieverName.toLowerCase().includes(query)
      )
    })
  }, [myRequests, requestStageFilter, requestStatusTab, requestsSearch])

  const requestStageOptions = useMemo(
    () =>
      Array.from(
        new Set(myRequests.map((request) => request.current_stage_code || request.approval_stage || "").filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [myRequests]
  )

  const relieverRows = useMemo(() => {
    const source = relieverTab === "active" ? activeRelieverCommitments : relieverCommitments
    const query = relieverSearch.trim().toLowerCase()
    if (!query) return source
    return source.filter((request) => {
      const requesterName = request.user?.full_name || request.user?.company_email || ""
      const leaveName = request.leave_type?.name || "Leave Request"
      return leaveName.toLowerCase().includes(query) || requesterName.toLowerCase().includes(query)
    })
  }, [activeRelieverCommitments, relieverCommitments, relieverSearch, relieverTab])
  useEffect(() => {
    if (!visibleLeaveTabs.some((tab) => tab.key === leaveTableTab)) {
      setLeaveTableTab(visibleLeaveTabs[0]?.key || "my-requests")
    }
  }, [leaveTableTab, visibleLeaveTabs])

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
    const [requestRes, typesRes, relieversRes] = await Promise.all([
      fetch("/api/hr/leave/requests"),
      fetch("/api/hr/leave/types"),
      fetch("/api/hr/leave/relievers"),
    ])

    const [requestPayload, typesPayload, relieversPayload] = await Promise.all([
      requestRes.json().catch(() => ({})),
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
  }, [])

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

  function handleAction(requestId: string, action: "approve" | "reject") {
    if (action === "reject") {
      setRejectPrompt({ open: true, requestId })
      return
    }
    void submitAction(requestId, "approve", "")
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
      await refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process action")
    }
  }

  function handleUploadEvidence(requestId: string, documentType: string) {
    setEvidencePrompt({ open: true, requestId, documentType })
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
      await refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload evidence")
    } finally {
      setUploadingEvidenceFor(null)
    }
  }

  return (
    <>
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Leave Management"
        description="All leave types are visible with explicit eligibility and evidence rules."
        icon={CalendarDays}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
        actions={
          <Button onClick={openCreateDialog} disabled={hasBlockingRequest}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Leave Records</CardTitle>
          <CardDescription>Task-style table views with row actions and filters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={leaveTableTab} onValueChange={(value) => setLeaveTableTab(value as LeaveTableTab)}>
            <TabsList className="h-auto flex-wrap justify-start gap-1">
              {visibleLeaveTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {leaveTableTab === "my-requests" && (
            <>
              <div className="space-y-1">
                <p className="font-medium">My Leave Requests</p>
                <p className="text-muted-foreground text-sm">Only leave requests you personally submitted.</p>
              </div>
              <Tabs
                value={requestStatusTab}
                onValueChange={(value) => setRequestStatusTab(value as MyRequestStatusTab)}
              >
                <TabsList className="h-auto flex-wrap justify-start gap-1">
                  <TabsTrigger value="all">All ({requestStatusCounts.all})</TabsTrigger>
                  <TabsTrigger value="pending">Pending ({requestStatusCounts.pending})</TabsTrigger>
                  <TabsTrigger value="approved">Approved ({requestStatusCounts.approved})</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected ({requestStatusCounts.rejected})</TabsTrigger>
                  <TabsTrigger value="cancelled">Cancelled ({requestStatusCounts.cancelled})</TabsTrigger>
                  <TabsTrigger value="other">Other ({requestStatusCounts.other})</TabsTrigger>
                </TabsList>
              </Tabs>
              <ListToolbar
                search={
                  <Input
                    placeholder="Search your leave requests"
                    value={requestsSearch}
                    onChange={(event) => setRequestsSearch(event.target.value)}
                    className="w-full sm:max-w-[320px]"
                  />
                }
                filters={
                  <Select value={requestStageFilter} onValueChange={setRequestStageFilter}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Filter by stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stages</SelectItem>
                      {requestStageOptions.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {formatStage(stage)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">S/N</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Reliever</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRequestRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground py-6 text-center">
                          No leave requests found for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      myRequestRows.map((request, index) => (
                        <TableRow key={request.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>{request.leave_type?.name || "Leave Request"}</TableCell>
                          <TableCell>
                            {formatDateLabel(request.start_date)} to {formatDateLabel(request.end_date)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getLeaveStatusBadgeVariant(request.status)}>
                              {formatApprovalStatus(request.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getLeaveStageBadgeVariant(request.current_stage_code || request.approval_stage)}
                            >
                              {formatStage(request.current_stage_code || request.approval_stage)}
                            </Badge>
                          </TableCell>
                          <TableCell>{request.reliever?.full_name || request.reliever?.company_email || "-"}</TableCell>
                          <TableCell className="max-w-[320px] truncate">{request.reason || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => setDetailRequest(request)}>
                                <Eye className="mr-1 h-4 w-4" />
                                View
                              </Button>
                              {isRequesterEditable(request) && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(request)}
                                    title="Edit request"
                                    aria-label="Edit request"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="destructive"
                                    className="h-8 w-8"
                                    onClick={() => handleDeleteRequest(request)}
                                    disabled={deletingRequestId === request.id}
                                    title="Delete request"
                                    aria-label="Delete request"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {request.status === "pending_evidence" &&
                                (request.missing_documents || []).map((doc) => (
                                  <Button
                                    key={`${request.id}-${doc}`}
                                    size="sm"
                                    variant="outline"
                                    disabled={uploadingEvidenceFor === request.id}
                                    onClick={() => handleUploadEvidence(request.id, doc)}
                                  >
                                    <Upload className="mr-1 h-3 w-3" />
                                    {prettyDocName(doc)}
                                  </Button>
                                ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {leaveTableTab === "reliever-commitments" && (
            <>
              <div className="space-y-1">
                <p className="font-medium">My Reliever Commitments</p>
                <p className="text-muted-foreground text-sm">
                  Leave requests where you are assigned as reliever. Overlapping personal leave requests are blocked for
                  these periods.
                </p>
              </div>
              <Tabs value={relieverTab} onValueChange={(value) => setRelieverTab(value as typeof relieverTab)}>
                <TabsList className="h-auto flex-wrap justify-start gap-1">
                  <TabsTrigger value="active">Active ({activeRelieverCommitments.length})</TabsTrigger>
                  <TabsTrigger value="all">All ({relieverCommitments.length})</TabsTrigger>
                </TabsList>
              </Tabs>
              <ListToolbar
                search={
                  <Input
                    placeholder="Search reliever commitments"
                    value={relieverSearch}
                    onChange={(event) => setRelieverSearch(event.target.value)}
                    className="w-full sm:max-w-[320px]"
                  />
                }
              />
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">S/N</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relieverRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                          No reliever commitments found for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      relieverRows.map((request, index) => (
                        <TableRow key={`reliever-${request.id}`}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>{request.leave_type?.name || "Leave Request"}</TableCell>
                          <TableCell>{request.user?.full_name || request.user?.company_email || "Unknown"}</TableCell>
                          <TableCell>
                            {formatDateLabel(request.start_date)} to {formatDateLabel(request.end_date)}
                          </TableCell>
                          <TableCell>{formatApprovalStatus(request.status)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => setDetailRequest(request)}>
                              <Eye className="mr-1 h-4 w-4" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
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
                  Department Lead:{" "}
                  {detailLeadApprover?.approver?.full_name ||
                    detailLeadApprover?.approver?.company_email ||
                    detailRequest.supervisor?.full_name ||
                    detailRequest.supervisor?.company_email ||
                    "Not assigned"}
                </p>
                <p className="text-muted-foreground">
                  Admin & HR Lead:{" "}
                  {detailHrApprover?.approver?.full_name || detailHrApprover?.approver?.company_email || "Not assigned"}
                </p>
                <p className="text-muted-foreground">
                  Current approver:{" "}
                  {["approved", "rejected", "cancelled"].includes(detailRequest.status)
                    ? "Completed (no current approver)"
                    : detailRequest.current_approver?.full_name ||
                      detailRequest.current_approver?.company_email ||
                      "Not assigned"}
                </p>
              </div>

              <div className="rounded-md border p-3">
                <p className="font-medium">Reason</p>
                <p className="text-muted-foreground mt-1">{detailRequest.reason || "No reason provided"}</p>
              </div>

              <div className="rounded-md border p-3">
                <p className="font-medium">Handover Note</p>
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
    <PromptDialog
      open={rejectPrompt?.open ?? false}
      onOpenChange={(open) => !open && setRejectPrompt(null)}
      title="Reject Leave Request"
      description="Provide a reason for rejecting this leave request."
      label="Rejection Reason"
      placeholder="Enter rejection reason..."
      inputType="textarea"
      required
      confirmLabel="Reject"
      confirmVariant="destructive"
      onConfirm={(reason) => {
        const { requestId } = rejectPrompt!
        setRejectPrompt(null)
        void submitAction(requestId, "reject", reason)
      }}
      onCancel={() => setRejectPrompt(null)}
    />

    <PromptDialog
      open={evidencePrompt?.open ?? false}
      onOpenChange={(open) => !open && setEvidencePrompt(null)}
      title="Upload Evidence"
      description={evidencePrompt ? `Enter the URL for ${prettyDocName(evidencePrompt.documentType)}` : ""}
      label="Document URL"
      placeholder="https://..."
      inputType="url"
      required
      confirmLabel="Upload"
      onConfirm={(url) => {
        const { requestId, documentType } = evidencePrompt!
        setEvidencePrompt(null)
        void submitEvidence(requestId, documentType, url)
      }}
      onCancel={() => setEvidencePrompt(null)}
    />
    </>
  )
}
