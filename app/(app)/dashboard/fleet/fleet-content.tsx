"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Car, Paperclip, Plus } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type FleetResource = {
  id: string
  name: string
  resource_type: string
  description?: string | null
  is_active: boolean
}

type FleetAttachment = {
  id: string
  file_name: string
  mime_type: string
  file_size: number
}

type FleetBooking = {
  id: string
  resource_id: string
  start_at: string
  end_at: string
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  admin_note?: string | null
  created_at: string
  resource?: FleetResource | null
  attachments?: FleetAttachment[]
}

type FleetSchedule = {
  id: string
  resource_id: string
  start_at: string
  end_at: string
  status: "pending" | "approved"
}

const statusVariant: Record<FleetBooking["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function toLocalDateTimeInput(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function FleetContent() {
  const [resources, setResources] = useState<FleetResource[]>([])
  const [bookings, setBookings] = useState<FleetBooking[]>([])
  const [schedule, setSchedule] = useState<FleetSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const [resourceId, setResourceId] = useState("")
  const [startAt, setStartAt] = useState("")
  const [endAt, setEndAt] = useState("")
  const [reason, setReason] = useState("")
  const [files, setFiles] = useState<File[]>([])

  const canSubmit = resourceId && startAt && endAt && reason.trim().length >= 10

  const selectedResourceSchedule = useMemo(() => {
    if (!resourceId) return []
    return schedule.filter((slot) => slot.resource_id === resourceId)
  }, [resourceId, schedule])

  const currentWindowConflicts = useMemo(() => {
    if (!resourceId || !startAt || !endAt) return []
    const start = new Date(startAt).getTime()
    const end = new Date(endAt).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) return []

    return selectedResourceSchedule.filter((slot) => {
      const slotStart = new Date(slot.start_at).getTime()
      const slotEnd = new Date(slot.end_at).getTime()
      return slotStart < end && slotEnd > start
    })
  }, [resourceId, startAt, endAt, selectedResourceSchedule])

  async function loadData() {
    setLoading(true)
    try {
      const [resourcesRes, bookingsRes] = await Promise.all([
        fetch("/api/fleet/resources"),
        fetch("/api/fleet/bookings"),
      ])
      const resourcesPayload = await resourcesRes.json()
      const bookingsPayload = await bookingsRes.json()

      if (!resourcesRes.ok) throw new Error(resourcesPayload.error || "Failed to load resources")
      if (!bookingsRes.ok) throw new Error(bookingsPayload.error || "Failed to load bookings")

      setResources(resourcesPayload.data || [])
      setBookings(bookingsPayload.data || [])
      setSchedule(bookingsPayload.resource_schedule || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load fleet booking data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Please complete all required fields. Reason must be at least 10 characters.")
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("resource_id", resourceId)
      formData.append("start_at", new Date(startAt).toISOString())
      formData.append("end_at", new Date(endAt).toISOString())
      formData.append("reason", reason.trim())
      files.forEach((file) => formData.append("attachments", file))

      const response = await fetch("/api/fleet/bookings", {
        method: "POST",
        body: formData,
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to submit booking")

      toast.success("Booking application submitted")
      setOpen(false)
      setResourceId("")
      setStartAt("")
      setEndAt("")
      setReason("")
      setFiles([])
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit booking")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(bookingId: string) {
    setCancelingId(bookingId)
    try {
      const response = await fetch(`/api/fleet/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to cancel booking")
      toast.success("Booking cancelled")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking")
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Fleet Booking"
        description="Book shared resources without time clashes. Reason is required; attachments are optional (PDF/images)."
        icon={Car}
        backLink={{ href: "/dashboard/leave", label: "Back to HR" }}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Applications</CardTitle>
              <CardDescription>Pending and approved requests block the slot for other users.</CardDescription>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Application
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-muted-foreground text-sm">Loading bookings...</p> : null}
            {!loading && bookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No fleet booking applications yet.</p>
            ) : null}
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{booking.resource?.name || "Resource"}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(booking.start_at)} - {formatDateTime(booking.end_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[booking.status]}>{booking.status}</Badge>
                    {(booking.status === "pending" || booking.status === "approved") &&
                    new Date(booking.start_at).getTime() > Date.now() ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(booking.id)}
                        disabled={cancelingId === booking.id}
                      >
                        {cancelingId === booking.id ? "Cancelling..." : "Cancel"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm">{booking.reason}</p>
                <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" /> {(booking.attachments || []).length} attachment(s)
                  </span>
                  {booking.admin_note ? <span>Admin note: {booking.admin_note}</span> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Occupied Slots
            </CardTitle>
            <CardDescription>
              {resourceId
                ? "Shows pending/approved bookings for the selected resource."
                : "Select a resource in the modal to preview occupied slots."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedResourceSchedule.slice(0, 8).map((slot) => (
              <div key={slot.id} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>{formatDateTime(slot.start_at)}</span>
                  <Badge variant={slot.status === "approved" ? "default" : "secondary"}>{slot.status}</Badge>
                </div>
                <div className="text-muted-foreground">to {formatDateTime(slot.end_at)}</div>
              </div>
            ))}
            {selectedResourceSchedule.length === 0 ? (
              <p className="text-muted-foreground text-xs">No occupied slots yet for selected resource.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fleet Booking Application</DialogTitle>
            <DialogDescription>
              Provide your date/time, reason, and optional supporting files (PDF/images).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Resource</Label>
              <Select value={resourceId} onValueChange={setResourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resource" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((resource) => (
                    <SelectItem key={resource.id} value={resource.id}>
                      {resource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={toLocalDateTimeInput(startAt)}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={toLocalDateTimeInput(endAt)}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State the business reason for this booking"
                rows={4}
              />
              <p className="text-muted-foreground text-xs">Minimum 10 characters</p>
            </div>

            <div className="space-y-2">
              <Label>Attachments (optional)</Label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <p className="text-muted-foreground text-xs">Accepted: PDF, JPG, JPEG, PNG, WEBP (max 10MB each).</p>
            </div>

            {currentWindowConflicts.length > 0 ? (
              <div className="border-destructive/40 bg-destructive/5 rounded border p-3 text-sm">
                <p className="font-medium">Time clash detected</p>
                <p className="text-muted-foreground">This slot overlaps an existing pending/approved booking.</p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting || currentWindowConflicts.length > 0}>
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
