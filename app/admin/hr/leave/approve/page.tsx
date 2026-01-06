"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CheckCircle, XCircle, Calendar, Clock, User, History } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface LeaveRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  days_count: number
  reason: string
  status: string
  created_at: string
  approved_at?: string
  rejected_reason?: string
  user: {
    first_name: string
    last_name: string
    company_email: string
    department_id: string
  }
  leave_type: {
    name: string
  }
  approver?: {
    first_name: string
    last_name: string
  }
}

export default function LeaveApprovePage() {
  const [loading, setLoading] = useState(true)
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([])
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [comments, setComments] = useState<{ [key: string]: string }>({})
  const [activeTab, setActiveTab] = useState("pending")

  useEffect(() => {
    fetchAllRequests()
  }, [])

  async function fetchAllRequests() {
    try {
      const supabase = createClient()

      // Fetch all leave requests
      const { data: requestsData, error } = await supabase
        .from("leave_requests")
        .select(
          `
                    *,
                    leave_type:leave_types(name)
                `
        )
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) {
        console.error("Error fetching requests:", error)
        toast.error("Failed to fetch leave requests")
        return
      }

      if (requestsData && requestsData.length > 0) {
        // Get unique user IDs and approver IDs
        const userIds = Array.from(new Set(requestsData.map((r) => r.user_id)))
        const approverIds = Array.from(new Set(requestsData.filter((r) => r.approved_by).map((r) => r.approved_by)))
        const allProfileIds = Array.from(new Set([...userIds, ...approverIds]))

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_email, department_id")
          .in("id", allProfileIds)

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

        const enrichedRequests = requestsData.map((r) => ({
          ...r,
          user: profileMap.get(r.user_id) || {
            first_name: "Unknown",
            last_name: "User",
            company_email: "",
            department_id: null,
          },
          approver: r.approved_by ? profileMap.get(r.approved_by) : undefined,
        }))

        setPendingRequests(enrichedRequests.filter((r) => r.status === "pending"))
        setAllRequests(enrichedRequests)
      } else {
        setPendingRequests([])
        setAllRequests([])
      }
    } catch (error) {
      console.error("Error fetching requests:", error)
      toast.error("Failed to load leave requests")
    } finally {
      setLoading(false)
    }
  }

  async function handleApproval(requestId: string, status: "approved" | "rejected") {
    setProcessing(requestId)
    try {
      const response = await fetch("/api/hr/leave/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_request_id: requestId,
          status,
          comments: comments[requestId] || "",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to process request")
      }

      toast.success(`Leave request ${status} successfully`)
      fetchAllRequests() // Refresh all data
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      toast.error(errorMessage)
    } finally {
      setProcessing(null)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "approved":
        return "bg-green-500"
      case "rejected":
        return "bg-red-500"
      case "pending":
        return "bg-orange-500"
      default:
        return "bg-gray-500"
    }
  }

  const approvedCount = allRequests.filter((r) => r.status === "approved").length
  const rejectedCount = allRequests.filter((r) => r.status === "rejected").length

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/admin/hr" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to HR Dashboard
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">Review, approve, and track employee leave requests</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-orange-500 px-4 py-2 text-lg text-orange-600">
            <Clock className="mr-1 h-4 w-4" />
            {pendingRequests.length} Pending
          </Badge>
          <Badge variant="outline" className="border-green-500 px-4 py-2 text-lg text-green-600">
            <CheckCircle className="mr-1 h-4 w-4" />
            {approvedCount} Approved
          </Badge>
          <Badge variant="outline" className="border-red-500 px-4 py-2 text-lg text-red-600">
            <XCircle className="mr-1 h-4 w-4" />
            {rejectedCount} Rejected
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Approval ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            All History ({allRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {loading ? (
            <div className="py-12 text-center">Loading...</div>
          ) : pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h3 className="text-lg font-semibold">All caught up!</h3>
                <p className="text-muted-foreground">No pending leave requests to approve</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {request.user.first_name} {request.user.last_name}
                        </CardTitle>
                        <CardDescription>{request.user.company_email}</CardDescription>
                      </div>
                      <Badge>{request.leave_type.name}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground text-sm">Start Date</p>
                        <p className="font-medium">{formatDate(request.start_date)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">End Date</p>
                        <p className="font-medium">{formatDate(request.end_date)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">Days</p>
                        <p className="font-medium">{request.days_count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">Requested</p>
                        <p className="font-medium">{formatDate(request.created_at)}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1 text-sm">Reason</p>
                      <p className="bg-muted rounded-lg p-3">{request.reason}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1 text-sm">Comments (optional)</p>
                      <Textarea
                        placeholder="Add comments for the employee..."
                        value={comments[request.id] || ""}
                        onChange={(e) => setComments({ ...comments, [request.id]: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => handleApproval(request.id, "approved")}
                        disabled={processing === request.id}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {processing === request.id ? "Processing..." : "Approve"}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleApproval(request.id, "rejected")}
                        disabled={processing === request.id}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {processing === request.id ? "Processing..." : "Reject"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {loading ? (
            <div className="py-12 text-center">Loading...</div>
          ) : allRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="text-lg font-semibold">No leave history</h3>
                <p className="text-muted-foreground">No leave requests have been submitted yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Leave Request History</CardTitle>
                <CardDescription>All leave requests and their outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allRequests.map((request) => (
                    <div key={request.id} className="flex items-start justify-between rounded-lg border p-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-muted rounded-full p-2">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">
                            {request.user.first_name} {request.user.last_name}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {request.leave_type.name} • {request.days_count} days
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {formatDate(request.start_date)} - {formatDate(request.end_date)}
                          </p>
                          <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">Reason: {request.reason}</p>
                          {request.status !== "pending" && request.approver && (
                            <p className="text-muted-foreground mt-1 text-sm">
                              {request.status === "approved" ? "Approved" : "Rejected"} by {request.approver.first_name}{" "}
                              {request.approver.last_name}
                              {request.approved_at && ` on ${formatDate(request.approved_at)}`}
                            </p>
                          )}
                          {request.rejected_reason && (
                            <p className="mt-1 text-sm text-red-600">Rejection reason: {request.rejected_reason}</p>
                          )}
                        </div>
                      </div>
                      <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
