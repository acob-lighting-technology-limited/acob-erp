"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Calendar, Plus, Pencil, Trash2, Clock, CheckCircle2, Plane } from "lucide-react"
import { toast } from "sonner"
import type { LeaveRequest, LeaveBalance, LeaveType } from "./page"
import { PageHeader, PageWrapper } from "@/components/layout"

interface LeaveContentProps {
  initialRequests: LeaveRequest[]
  initialBalances: LeaveBalance[]
  initialLeaveTypes: LeaveType[]
}

export function LeaveContent({ initialRequests, initialBalances, initialLeaveTypes }: LeaveContentProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
  const [balances, setBalances] = useState<LeaveBalance[]>(initialBalances)
  const [leaveTypes] = useState<LeaveType[]>(initialLeaveTypes)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null)
  const [deletingRequest, setDeletingRequest] = useState<LeaveRequest | null>(null)
  const [formData, setFormData] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  })

  const hasPendingRequest = requests.some((r) => r.status === "pending")

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const activeLeaves = requests.filter((r) => {
    if (r.status !== "approved") return false
    const endDate = new Date(r.end_date)
    endDate.setHours(23, 59, 59, 999)
    return endDate >= today
  })

  const activeBalances = balances.filter((b) => {
    if (b.used_days > 0) return true
    return requests.some((r) => r.leave_type_id === b.leave_type_id)
  })

  async function fetchLeaveData() {
    try {
      const response = await fetch("/api/hr/leave/requests")
      const data = await response.json()
      if (data.requests) {
        setRequests(data.requests)
      }
      if (data.balances) {
        setBalances(data.balances)
      }
    } catch (error) {
      console.error("Error fetching leave data:", error)
    }
  }

  function calculateDays(): number {
    if (!formData.start_date || !formData.end_date) return 0
    const start = new Date(formData.start_date)
    const end = new Date(formData.end_date)
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return diff > 0 ? diff : 0
  }

  function getAvailableDays(): number {
    if (!formData.leave_type_id) return 0
    const balance = balances.find((b) => b.leave_type_id === formData.leave_type_id)
    if (balance) return balance.balance_days
    const type = leaveTypes.find((t) => t.id === formData.leave_type_id)
    return type ? type.max_days : 0
  }

  function getMaxDaysForType(): number {
    if (!formData.leave_type_id) return 0
    const type = leaveTypes.find((t) => t.id === formData.leave_type_id)
    return type ? type.max_days : 0
  }

  function getLeaveProgress(request: LeaveRequest) {
    const start = new Date(request.start_date)
    const end = new Date(request.end_date)
    const now = new Date()

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    now.setHours(12, 0, 0, 0)

    if (now < start) {
      const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { status: "upcoming", progress: 0, message: `Starts in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}` }
    }

    if (now > end) {
      return { status: "completed", progress: 100, message: "Completed" }
    }

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const daysPassed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const progress = Math.min(100, Math.round((daysPassed / totalDays) * 100))
    const daysLeft = totalDays - daysPassed

    return { status: "active", progress, message: `Day ${daysPassed} of ${totalDays} (${daysLeft} left)` }
  }

  function openNewRequestDialog() {
    setEditingRequest(null)
    setFormData({ leave_type_id: "", start_date: "", end_date: "", reason: "" })
    setDialogOpen(true)
  }

  function openEditDialog(request: LeaveRequest) {
    setEditingRequest(request)
    setFormData({
      leave_type_id: request.leave_type_id,
      start_date: request.start_date,
      end_date: request.end_date,
      reason: request.reason,
    })
    setDialogOpen(true)
  }

  function openDeleteDialog(request: LeaveRequest) {
    setDeletingRequest(request)
    setDeleteDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const isEdit = !!editingRequest
      const url = "/api/hr/leave/requests"
      const method = isEdit ? "PUT" : "POST"
      const body = isEdit
        ? { id: editingRequest.id, ...formData, days_count: calculateDays() }
        : { ...formData, days_count: calculateDays() }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request")
      }

      toast.success(isEdit ? "Leave request updated successfully" : "Leave request submitted successfully")
      setDialogOpen(false)
      setEditingRequest(null)
      setFormData({ leave_type_id: "", start_date: "", end_date: "", reason: "" })
      fetchLeaveData()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deletingRequest) return
    setSubmitting(true)

    try {
      const response = await fetch(`/api/hr/leave/requests?id=${deletingRequest.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete request")
      }

      toast.success("Leave request deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingRequest(null)
      fetchLeaveData()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
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

  const daysRequested = calculateDays()
  const availableDays = getAvailableDays()
  const isValid =
    formData.leave_type_id &&
    formData.start_date &&
    formData.end_date &&
    formData.reason.length >= 10 &&
    daysRequested <= availableDays

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Leave Management"
        description="Manage your leave requests and balances"
        icon={Plane}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
        actions={
          <Button onClick={openNewRequestDialog} disabled={hasPendingRequest} className="gap-2">
            <Plus className="h-4 w-4" />
            Request Leave
          </Button>
        }
      />

      {hasPendingRequest && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-100 p-4 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          <Clock className="h-5 w-5" />
          You have a pending leave request. Please wait for it to be processed or cancel it before submitting a new one.
        </div>
      )}

      {/* Active/Upcoming Leaves */}
      {activeLeaves.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Plane className="h-5 w-5" />
            Active & Upcoming Leave
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeLeaves.map((leave) => {
              const { status, progress, message } = getLeaveProgress(leave)
              return (
                <Card key={leave.id} className={status === "active" ? "border-2 border-green-500" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {status === "active" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {status === "upcoming" && <Clock className="h-5 w-5 text-blue-500" />}
                        {leave.leave_type.name}
                      </CardTitle>
                      <Badge className={status === "active" ? "bg-green-500" : "bg-blue-500"}>
                        {status === "active" ? "On Leave" : "Upcoming"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {new Date(leave.start_date).toLocaleDateString()} -{" "}
                      {new Date(leave.end_date).toLocaleDateString()} ({leave.days_count} days)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{message}</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className={`h-full transition-all duration-500 ${status === "active" ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Leave Balances */}
      {activeBalances.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">Leave Balances</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {activeBalances.map((balance, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{balance.leave_type.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{balance.balance_days}</div>
                  <p className="text-muted-foreground text-xs">of {balance.allocated_days} days remaining</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(Math.max(0, balance.balance_days) / balance.allocated_days) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {editingRequest ? "Edit Leave Request" : "Request Leave"}
            </DialogTitle>
            <DialogDescription>
              {editingRequest ? "Modify your pending leave request" : "Submit a new leave request for approval"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leave_type">Leave Type</Label>
              <Select
                value={formData.leave_type_id}
                onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.max_days} days/year)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.leave_type_id && (
                <p className="text-muted-foreground text-sm">
                  You have <strong>{availableDays}</strong> days remaining out of {getMaxDaysForType()} allocated.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date || new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            {daysRequested > 0 && (
              <div
                className={`rounded-lg p-3 ${daysRequested <= availableDays ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"}`}
              >
                Days requested: <strong>{daysRequested}</strong>
                {daysRequested > availableDays && (
                  <span className="mt-1 block font-medium">
                    Exceeds your available balance of {availableDays} days.
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for your leave request (min 10 characters)"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
              />
              <p className="text-muted-foreground text-sm">{formData.reason.length}/10 characters minimum</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !isValid}>
                {submitting ? "Saving..." : editingRequest ? "Save Changes" : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {submitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Request History</CardTitle>
          <CardDescription>Your leave requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No leave requests yet. Click &quot;Request Leave&quot; to create one.
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Calendar className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="font-medium">{request.leave_type.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {new Date(request.start_date).toLocaleDateString()} -{" "}
                        {new Date(request.end_date).toLocaleDateString()} ({request.days_count} days)
                      </p>
                      <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">{request.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(request)}
                          title="Edit request"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(request)}
                          title="Delete request"
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
