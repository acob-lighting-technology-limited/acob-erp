"use client"

import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { TableSkeleton, QueryError } from "@/components/ui/query-states"
import { Clock, History, CalendarCheck2, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { PromptDialog } from "@/components/ui/prompt-dialog"

interface LeaveItem {
  id: string
  user_id: string
  start_date: string
  end_date: string
  resume_date: string
  days_count: number
  reason: string
  status: string
  approval_stage: string
  current_stage_code?: string
  current_stage_order?: number
  current_approver_user_id?: string
  created_at: string
  user?: { full_name: string; company_email: string }
  leave_type?: { name: string }
  current_approver?: { id: string; full_name: string; company_email: string; role?: string | null } | null
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

interface ActionDialogState {
  open: boolean
  id: string
  action: "approve" | "reject"
  /** Set when approve requires evidence override */
  missingDocuments: string[]
}

async function fetchLeaveApprovalData(): Promise<{
  myQueue: LeaveItem[]
  allPendingQueue: LeaveItem[]
  history: LeaveItem[]
}> {
  const [myQueueRes, allQueueRes, requestsRes] = await Promise.all([
    fetch("/api/hr/leave/queue"),
    fetch("/api/hr/leave/queue?all=true"),
    fetch("/api/hr/leave/requests?all=true"),
  ])
  if (!myQueueRes.ok || !allQueueRes.ok || !requestsRes.ok) throw new Error("Failed to load leave data")
  const myQueuePayload = await myQueueRes.json()
  const allQueuePayload = await allQueueRes.json()
  const requestPayload = await requestsRes.json()
  const allRequests = (requestPayload.data || []) as LeaveItem[]
  return {
    myQueue: myQueuePayload.data || [],
    allPendingQueue: allQueuePayload.data || [],
    history: allRequests.filter(
      (item) => !["pending", "pending_evidence"].includes(String(item.status || "").toLowerCase())
    ),
  }
}

export default function LeaveApprovePage() {
  const queryClient = useQueryClient()
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    open: false,
    id: "",
    action: "reject",
    missingDocuments: [],
  })
  // Ref to carry "overrideEvidence" flag from the dialog into submitAction
  const overrideEvidenceRef = useRef(false)

  const {
    data,
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.leaveRequests({ scope: "approve" }),
    queryFn: fetchLeaveApprovalData,
  })

  const myQueue = data?.myQueue ?? []
  const allPendingQueue = data?.allPendingQueue ?? []
  const history = data?.history ?? []

  const { mutate: submitActionMutate } = useMutation({
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
      const response = await fetch("/api/hr/leave/approve", {
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveRequests({ scope: "approve" }) })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to process action")
    },
  })

  function handleAction(id: string, action: "approve" | "reject") {
    const target = myQueue.find((item) => item.id === id) || history.find((item) => item.id === id)
    const needsOverride = action === "approve" && target && target.evidence_complete === false

    if (action === "approve" && !needsOverride) {
      // No prompt needed — submit directly
      submitActionMutate({ id, action: "approve", comments: "", overrideEvidence: false })
      return
    }

    // Open the appropriate dialog
    overrideEvidenceRef.current = needsOverride ?? false
    setActionDialog({
      open: true,
      id,
      action,
      missingDocuments: needsOverride ? target?.missing_documents || [] : [],
    })
  }

  function submitAction(id: string, action: "approve" | "reject", comments: string, overrideEvidence: boolean) {
    submitActionMutate({ id, action, comments, overrideEvidence })
  }

  function expectedApproverLabel(item: LeaveItem) {
    if (item.current_approver?.full_name) return item.current_approver.full_name
    const stage = item.current_stage_code || item.approval_stage
    const expectedByStage: Record<string, string> = {
      pending_reliever: "Assigned Reliever",
      reliever_pending: "Assigned Reliever",
      pending_department_lead: "Department Lead",
      supervisor_pending: "Department Lead",
      pending_admin_hr_lead: "Admin & HR Lead",
      hr_pending: "Admin & HR Lead",
      pending_md: "Managing Director (MD)",
      pending_hcs: "Head, Corporate Services (HCS)",
    }
    return expectedByStage[stage] || "Pending approver"
  }

  const stats = {
    pending: allPendingQueue.length,
    myQueue: myQueue.length,
    history: history.length,
  }

  const isOverride = actionDialog.missingDocuments.length > 0

  return (
    <>
      <PromptDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog((s) => ({ ...s, open }))}
        title={isOverride ? "Override Incomplete Evidence" : "Rejection Reason"}
        description={
          isOverride
            ? `Evidence is incomplete (${actionDialog.missingDocuments.join(", ")}). Provide an override reason to proceed with approval.`
            : "Please provide a reason for rejecting this leave request."
        }
        label={isOverride ? "Override reason" : "Rejection reason"}
        placeholder={isOverride ? "Explain why evidence requirement is being waived…" : "Enter rejection reason…"}
        inputType="textarea"
        required
        confirmLabel={isOverride ? "Approve with Override" : "Reject"}
        confirmVariant={isOverride ? "default" : "destructive"}
        onConfirm={(value) => {
          void submitAction(actionDialog.id, actionDialog.action, value, overrideEvidenceRef.current)
        }}
      />
      <AdminTablePage
        title="Leave Approvals"
        description="HR final endorsement dashboard with full leave history"
        icon={CalendarCheck2}
        backLinkHref="/admin/hr"
        backLinkLabel="Back to HR Dashboard"
        stats={
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
            <StatCard title="Pending Queue" value={stats.pending} icon={Clock} />
            <StatCard
              title="My Actions"
              value={stats.myQueue}
              icon={AlertCircle}
              iconBgColor="bg-orange-100 dark:bg-orange-900/30"
              iconColor="text-orange-600 dark:text-orange-400"
            />
            <StatCard
              title="History"
              value={stats.history}
              icon={CheckCircle2}
              iconBgColor="bg-green-100 dark:bg-green-900/30"
              iconColor="text-green-600 dark:text-green-400"
            />
          </div>
        }
      >
        <Tabs defaultValue="pending">
          <TabsList className="mb-4">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" /> Pending Queue ({allPendingQueue.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" /> History ({history.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Pending Leave Workflow</CardTitle>
                  <CardDescription>
                    Every pending leave request is listed with current stage and the exact approver responsible for the
                    next step.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading && <TableSkeleton rows={5} cols={7} />}
                  {isError && <QueryError message="Could not load leave data." onRetry={refetch} />}
                  {!loading && !isError && allPendingQueue.length === 0 && (
                    <EmptyState
                      title="No pending requests"
                      description="There are no leave requests waiting for review."
                    />
                  )}
                  {!loading && !isError && allPendingQueue.length > 0 && (
                    <div className="overflow-x-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[64px]">S/N</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Leave Type</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Current Stage</TableHead>
                            <TableHead>Current Approver</TableHead>
                            <TableHead>Evidence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPendingQueue.map((item, index) => (
                            <TableRow key={item.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{item.user?.full_name || "Employee"}</TableCell>
                              <TableCell>{item.leave_type?.name || "Leave Request"}</TableCell>
                              <TableCell className="text-xs">
                                {item.start_date} to {item.end_date}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {STAGE_LABELS[item.current_stage_code || item.approval_stage] ||
                                    item.current_stage_code ||
                                    item.approval_stage}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{expectedApproverLabel(item)}</TableCell>
                              <TableCell>
                                <Badge variant={item.evidence_complete ? "default" : "secondary"}>
                                  {item.evidence_complete ? "Complete" : "Incomplete"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>My Action Queue</CardTitle>
                  <CardDescription>Only requests assigned to you can be endorsed or rejected here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loading && <TableSkeleton rows={5} cols={7} />}
                  {!loading && !isError && myQueue.length === 0 && (
                    <EmptyState
                      title="No actions assigned to you"
                      description="Your approval queue is currently clear."
                    />
                  )}
                  {myQueue.map((item) => (
                    <div key={item.id} className="rounded border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{item.user?.full_name || "Employee"}</p>
                        <Badge variant="outline">
                          {STAGE_LABELS[item.current_stage_code || item.approval_stage] ||
                            item.current_stage_code ||
                            item.approval_stage}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {item.start_date} to {item.end_date} | Resume {item.resume_date} | {item.days_count} day(s)
                      </p>
                      <p className="mt-2 text-sm">{item.reason}</p>
                      <div className="mt-2 space-y-1 text-xs">
                        <p>
                          Evidence:{" "}
                          <span className={item.evidence_complete ? "text-green-600" : "text-amber-600"}>
                            {item.evidence_complete ? "Complete" : "Incomplete"}
                          </span>
                        </p>
                        {(item.required_documents || []).length > 0 && (
                          <p>Required docs: {(item.required_documents || []).join(", ")}</p>
                        )}
                        {(item.missing_documents || []).length > 0 && (
                          <p className="text-amber-600">Missing docs: {(item.missing_documents || []).join(", ")}</p>
                        )}
                        {(item.evidence || []).length > 0 && (
                          <div className="space-y-1">
                            {(item.evidence || []).map((doc) => (
                              <p key={doc.id}>
                                - {doc.document_type} ({doc.status}){" "}
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  className="text-blue-600 underline"
                                  rel="noreferrer"
                                >
                                  view
                                </a>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => handleAction(item.id, "approve")}>
                          Endorse
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(item.id, "reject")}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Leave History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading && <TableSkeleton rows={5} cols={7} />}
                {!loading && !isError && history.length === 0 && (
                  <EmptyState
                    title="No history found"
                    description="Completed and rejected requests will appear here."
                  />
                )}
                {!loading && !isError && history.length > 0 && (
                  <div className="overflow-x-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[64px]">S/N</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead>Leave Type</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Stage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{item.user?.full_name || "Employee"}</TableCell>
                            <TableCell>{item.leave_type?.name || "Leave Request"}</TableCell>
                            <TableCell className="text-xs">
                              {item.start_date} to {item.end_date} | Resume {item.resume_date}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === "approved"
                                    ? "default"
                                    : item.status === "rejected"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {STAGE_LABELS[item.current_stage_code || item.approval_stage] ||
                                  item.current_stage_code ||
                                  item.approval_stage}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </AdminTablePage>
    </>
  )
}
