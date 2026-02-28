"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, History } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  created_at: string
  user?: { full_name: string; company_email: string }
  leave_type?: { name: string }
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
  reliever_pending: "Waiting Reliever",
  supervisor_pending: "Waiting Supervisor",
  hr_pending: "Waiting HR",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

export default function LeaveApprovePage() {
  const [loading, setLoading] = useState(true)
  const [pendingQueue, setPendingQueue] = useState<LeaveItem[]>([])
  const [history, setHistory] = useState<LeaveItem[]>([])

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [queueRes, requestsRes] = await Promise.all([fetch("/api/hr/leave/queue"), fetch("/api/hr/leave/requests")])
      const queuePayload = await queueRes.json()
      const requestPayload = await requestsRes.json()

      setPendingQueue(queuePayload.data || [])
      setHistory(requestPayload.data || [])
    } catch {
      toast.error("Failed to load leave data")
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    const target = pendingQueue.find((item) => item.id === id) || history.find((item) => item.id === id)
    const needsOverride = action === "approve" && target && target.evidence_complete === false

    let comments = action === "reject" ? window.prompt("Rejection reason") || "" : ""
    let overrideEvidence = false

    if (needsOverride) {
      comments =
        window.prompt(
          `Evidence is incomplete (${(target?.missing_documents || []).join(", ")}). Enter override reason to proceed:`
        ) || ""
      if (!comments.trim()) {
        toast.error("Override reason is required when evidence is incomplete")
        return
      }
      overrideEvidence = true
    }

    if (action === "reject" && !comments.trim()) {
      toast.error("Rejection reason is required")
      return
    }

    try {
      const response = await fetch("/api/hr/leave/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leave_request_id: id, action, comments, override_evidence: overrideEvidence }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to process action")

      toast.success(payload.message || "Action completed")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process action")
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        <Link href="/admin/hr" className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to HR Dashboard
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Leave Approvals</h1>
        <p className="text-muted-foreground">HR final endorsement dashboard with full leave history</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" /> Pending Queue ({pendingQueue.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending HR Actions</CardTitle>
              <CardDescription>Only requests that reached HR stage appear here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && <p>Loading...</p>}
              {!loading && pendingQueue.length === 0 && (
                <p className="text-muted-foreground text-sm">No pending requests.</p>
              )}
              {pendingQueue.map((item) => (
                <div key={item.id} className="rounded border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{item.user?.full_name || "Employee"}</p>
                    <Badge variant="outline">{STAGE_LABELS[item.approval_stage] || item.approval_stage}</Badge>
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
                            <a href={doc.file_url} target="_blank" className="text-blue-600 underline" rel="noreferrer">
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
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>All Leave Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && <p>Loading...</p>}
              {!loading && history.length === 0 && <p className="text-muted-foreground text-sm">No history found.</p>}
              {history.map((item) => (
                <div key={item.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{item.user?.full_name || "Employee"}</p>
                    <div className="flex gap-2">
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
                      <Badge variant="outline">{STAGE_LABELS[item.approval_stage] || item.approval_stage}</Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {item.start_date} to {item.end_date} | Resume {item.resume_date}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
