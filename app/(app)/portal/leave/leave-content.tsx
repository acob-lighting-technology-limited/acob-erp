"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { CalendarDays, Clock, Plus, Upload } from "lucide-react"
import type { LeaveBalance, LeaveRequest, LeaveType } from "./page"

interface LeaveContentProps {
  initialRequests: LeaveRequest[]
  initialBalances: LeaveBalance[]
  initialLeaveTypes: LeaveType[]
}

const STAGE_LABELS: Record<string, string> = {
  reliever_pending: "Waiting Reliever",
  supervisor_pending: "Waiting Supervisor",
  hr_pending: "Waiting HR",
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

export function LeaveContent({ initialRequests, initialBalances, initialLeaveTypes }: LeaveContentProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
  const [balances, setBalances] = useState<LeaveBalance[]>(initialBalances)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(initialLeaveTypes)
  const [approverQueue, setApproverQueue] = useState<LeaveRequest[]>([])
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingEvidenceFor, setUploadingEvidenceFor] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    leave_type_id: "",
    start_date: "",
    days_count: 1,
    reason: "",
    reliever_identifier: "",
    handover_note: "",
    handover_checklist_url: "",
  })

  const hasPendingRequest = requests.some((request) => ["pending", "pending_evidence"].includes(request.status))
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

  async function refreshData() {
    const [requestRes, queueRes, typesRes] = await Promise.all([
      fetch("/api/hr/leave/requests"),
      fetch("/api/hr/leave/queue"),
      fetch("/api/hr/leave/types"),
    ])

    const requestPayload = await requestRes.json()
    const queuePayload = await queueRes.json()
    const typesPayload = await typesRes.json()

    setRequests(requestPayload.data || [])
    setBalances(requestPayload.balances || [])
    setApproverQueue(queuePayload.data || [])
    setLeaveTypes(typesPayload.data || [])
  }

  async function handleCreateRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/hr/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to submit leave request")

      toast.success(payload.message || "Leave request submitted successfully")
      setOpen(false)
      setFormData({
        leave_type_id: "",
        start_date: "",
        days_count: 1,
        reason: "",
        reliever_identifier: "",
        handover_note: "",
        handover_checklist_url: "",
      })
      await refreshData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(message)
    } finally {
      setSubmitting(false)
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
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">
            All leave types are visible with explicit eligibility and evidence rules.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={hasPendingRequest}>
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Types and Balances</CardTitle>
          <CardDescription>Professional governance: policy + evidence + transparent eligibility</CardDescription>
        </CardHeader>
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
      </Card>

      {approverQueue.length > 0 && (
        <Card>
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
                  <Badge variant="outline">{STAGE_LABELS[item.approval_stage] || item.approval_stage}</Badge>
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
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((request) => (
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
                    {STAGE_LABELS[request.approval_stage] || request.approval_stage || "N/A"}
                  </Badge>
                </div>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {request.start_date} to {request.end_date} | Resume: {request.resume_date} | {request.days_count} day(s)
              </p>
              <p className="mt-2 text-sm">{request.reason}</p>
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
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Submit Leave Request
            </DialogTitle>
            <DialogDescription>
              Request flow: Reliever {"->"} Supervisor {"->"} HR
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateRequest}>
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
              <Label>Reliever (name, email, or ID)</Label>
              <Input
                value={formData.reliever_identifier}
                onChange={(event) => setFormData((prev) => ({ ...prev, reliever_identifier: event.target.value }))}
                placeholder="e.g. staff@company.com"
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

            <div className="space-y-2">
              <Label>Handover Checklist URL (optional)</Label>
              <Input
                type="url"
                value={formData.handover_checklist_url}
                onChange={(event) => setFormData((prev) => ({ ...prev, handover_checklist_url: event.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
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
    </div>
  )
}
