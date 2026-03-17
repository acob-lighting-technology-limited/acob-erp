"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"
import type { LeaveRequest } from "@/app/(app)/dashboard/leave/page"

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

function prettyDocName(name: string) {
  return name.replaceAll("_", " ")
}

interface LeaveRequestsCardProps {
  ongoingRequests: LeaveRequest[]
  historyRequests: LeaveRequest[]
  filteredHistoryRequests: LeaveRequest[]
  requestsTab: "ongoing" | "history"
  setRequestsTab: (tab: "ongoing" | "history") => void
  historyFilter: "all" | "approved" | "rejected" | "cancelled"
  setHistoryFilter: (filter: "all" | "approved" | "rejected" | "cancelled") => void
  uploadingEvidenceFor: string | null
  deletingRequestId: string | null
  isRequesterEditable: (request: LeaveRequest) => boolean
  onEdit: (request: LeaveRequest) => void
  onDeleteRequest: (request: LeaveRequest) => void
  onUploadEvidence: (requestId: string, documentType: string) => void
}

export function LeaveRequestsCard({
  ongoingRequests,
  historyRequests,
  filteredHistoryRequests,
  requestsTab,
  setRequestsTab,
  historyFilter,
  setHistoryFilter,
  uploadingEvidenceFor,
  deletingRequestId,
  isRequesterEditable,
  onEdit,
  onDeleteRequest,
  onUploadEvidence,
}: LeaveRequestsCardProps) {
  const displayedRequests = requestsTab === "ongoing" ? ongoingRequests : filteredHistoryRequests

  return (
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

        {displayedRequests.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
            {requestsTab === "ongoing" ? "No ongoing requests." : "No history requests for this filter."}
          </div>
        ) : (
          displayedRequests.map((request) => (
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
                {request.start_date} to {request.end_date} | Resume: {request.resume_date} | {request.days_count} day(s)
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
                          onClick={() => onUploadEvidence(request.id, doc)}
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
                  <Button size="sm" variant="outline" onClick={() => onEdit(request)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (isRequesterEditable(request)) onDeleteRequest(request)
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
  )
}
