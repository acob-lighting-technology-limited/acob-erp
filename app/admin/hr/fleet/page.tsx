"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarCheck2, CheckCircle2, Paperclip, Plus, XCircle } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
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
import { StatCard } from "@/components/ui/stat-card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { QUERY_KEYS } from "@/lib/query-keys"
import { TableSkeleton } from "@/components/ui/query-states"

type FleetResource = {
  id: string
  name: string
  resource_type: string
  description?: string | null
  is_active: boolean
}

type FleetBooking = {
  id: string
  resource_id: string
  start_at: string
  end_at: string
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  admin_note?: string | null
  requester?: { id: string; full_name?: string | null; company_email?: string | null } | null
  reviewer?: { id: string; full_name?: string | null } | null
  resource?: FleetResource | null
  attachment_count?: number
}

type FleetAttachment = {
  id: string
  file_name: string
  mime_type: string
  file_size: number
  signed_url?: string | null
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

async function fetchFleetResources(): Promise<FleetResource[]> {
  const response = await fetch("/api/admin/hr/fleet/resources")
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || "Failed to load resources")
  return payload.data || []
}

async function fetchFleetBookings(status?: string): Promise<FleetBooking[]> {
  const statusParam = status === "pending" ? "?status=pending" : ""
  const response = await fetch(`/api/admin/hr/fleet/bookings${statusParam}`)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || "Failed to load bookings")
  return payload.data || []
}

export default function AdminFleetPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<"pending" | "all">("pending")

  const [resourceName, setResourceName] = useState("")
  const [resourceType, setResourceType] = useState("general")
  const [resourceDescription, setResourceDescription] = useState("")
  const [savingResource, setSavingResource] = useState(false)

  const [selectedBooking, setSelectedBooking] = useState<FleetBooking | null>(null)
  const [attachments, setAttachments] = useState<FleetAttachment[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [adminNote, setAdminNote] = useState("")

  const { data: resources = [], isLoading: loadingResources } = useQuery({
    queryKey: QUERY_KEYS.adminFleetResources(),
    queryFn: fetchFleetResources,
  })

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: QUERY_KEYS.adminFleetBookings(tab),
    queryFn: () => fetchFleetBookings(tab),
  })

  async function createResource() {
    setSavingResource(true)
    try {
      const response = await fetch("/api/admin/hr/fleet/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: resourceName,
          resource_type: resourceType,
          description: resourceDescription,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to create resource")

      toast.success("Resource created")
      setResourceName("")
      setResourceType("general")
      setResourceDescription("")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminFleetResources() })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create resource")
    } finally {
      setSavingResource(false)
    }
  }

  async function toggleResource(resource: FleetResource) {
    try {
      const response = await fetch("/api/admin/hr/fleet/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resource.id, is_active: !resource.is_active }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to update resource")
      toast.success(`Resource ${resource.is_active ? "deactivated" : "activated"}`)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminFleetResources() })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update resource")
    }
  }

  async function openReview(booking: FleetBooking) {
    setSelectedBooking(booking)
    setAdminNote(booking.admin_note || "")
    setAttachments([])

    try {
      const response = await fetch(`/api/fleet/bookings/${booking.id}/attachments`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to load attachments")
      setAttachments(payload.data || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load attachments")
    }
  }

  async function review(action: "approve" | "reject") {
    if (!selectedBooking) return
    setReviewing(true)
    try {
      const response = await fetch(`/api/admin/hr/fleet/bookings/${selectedBooking.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, admin_note: adminNote }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Review failed")
      toast.success(`Booking ${action}d`)
      setSelectedBooking(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminFleetBookings(tab) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed")
    } finally {
      setReviewing(false)
    }
  }

  const pendingCount = bookings.filter((booking) => booking.status === "pending").length
  const approvedCount = bookings.filter((booking) => booking.status === "approved").length
  const rejectedCount = bookings.filter((booking) => booking.status === "rejected").length

  return (
    <AdminTablePage
      title="Fleet Booking Admin"
      description="Manage bookable resources and review booking applications"
      icon={CalendarCheck2}
      backLinkHref="/admin/hr"
      backLinkLabel="Back to HR Dashboard"
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Pending" value={pendingCount} icon={CalendarCheck2} />
          <StatCard title="Approved" value={approvedCount} icon={CheckCircle2} />
          <StatCard title="Rejected" value={rejectedCount} icon={XCircle} />
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>New Resource</CardTitle>
            <CardDescription>Create additional bookable items for Fleet module.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                placeholder="Delivery Car"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={resourceType} onChange={(e) => setResourceType(e.target.value)} placeholder="vehicle" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={resourceDescription}
                onChange={(e) => setResourceDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <Button
              onClick={createResource}
              disabled={savingResource || resourceName.trim().length < 2}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" /> {savingResource ? "Saving..." : "Create Resource"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>Activate/deactivate resources available for booking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingResources ? (
              <TableSkeleton rows={3} cols={2} />
            ) : (
              <>
                {resources.map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-muted-foreground text-xs">{resource.resource_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={resource.is_active ? "default" : "outline"}>
                        {resource.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => toggleResource(resource)}>
                        {resource.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))}
                {resources.length === 0 ? <p className="text-muted-foreground text-sm">No resources found.</p> : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Booking Applications</CardTitle>
          <CardDescription>Review pending requests and inspect reason/attachments before action.</CardDescription>
          <Tabs value={tab} onValueChange={(value) => setTab(value as "pending" | "all")}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingBookings ? <TableSkeleton rows={3} cols={3} /> : null}
          {!loadingBookings && bookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No bookings found.</p>
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
                  <Badge
                    variant={
                      booking.status === "approved"
                        ? "default"
                        : booking.status === "pending"
                          ? "secondary"
                          : booking.status === "rejected"
                            ? "destructive"
                            : "outline"
                    }
                  >
                    {booking.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => openReview(booking)}>
                    Review
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm">{booking.reason}</p>
              <div className="text-muted-foreground mt-2 text-xs">
                <p>Requester: {booking.requester?.full_name || booking.requester?.company_email || "Employee"}</p>
                <p className="inline-flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" /> {booking.attachment_count || 0} attachment(s)
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedBooking)} onOpenChange={(open) => (!open ? setSelectedBooking(null) : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Fleet Application</DialogTitle>
            <DialogDescription>Confirm the reason and supporting files before approval.</DialogDescription>
          </DialogHeader>

          {selectedBooking ? (
            <div className="space-y-4 py-2">
              <div className="rounded border p-3">
                <p className="font-medium">{selectedBooking.resource?.name || "Resource"}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(selectedBooking.start_at)} - {formatDateTime(selectedBooking.end_at)}
                </p>
                <p className="mt-2 text-sm">{selectedBooking.reason}</p>
              </div>

              <div className="space-y-2">
                <Label>Attachments</Label>
                {attachments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No attachments provided.</p>
                ) : null}
                {attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <p>{file.file_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {file.mime_type} • {(file.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    {file.signed_url ? (
                      <a
                        href={file.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-sm underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unavailable</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Admin Note</Label>
                <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBooking(null)}>
              Close
            </Button>
            {selectedBooking?.status === "pending" ? (
              <>
                <Button variant="destructive" onClick={() => review("reject")} disabled={reviewing}>
                  Reject
                </Button>
                <Button onClick={() => review("approve")} disabled={reviewing}>
                  Approve
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminTablePage>
  )
}
