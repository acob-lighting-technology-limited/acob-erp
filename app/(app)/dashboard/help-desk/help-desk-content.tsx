"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Headset, Plus } from "lucide-react"

interface HelpDeskTicket {
  id: string
  ticket_number: string
  title: string
  service_department: string
  request_type: "support" | "procurement"
  priority: "low" | "medium" | "high" | "urgent"
  status: string
  assigned_to: string | null
  requester_id: string
  created_at: string
  resolved_at: string | null
  csat_rating: number | null
  handling_mode?: string | null
  support_mode?: string | null
  requester_department?: string | null
}

interface HelpDeskContentProps {
  userId: string
  userDepartment: string | null
  canReviewPendingApprovals: boolean
  initialDepartments: string[]
  initialTickets: HelpDeskTicket[]
  initialError?: string | null
}

function buildFetchDebugLabel(source: string, status: number, payload: any) {
  const detail = payload?.error || payload?.message || (typeof payload === "string" ? payload : "") || "Unknown error"
  return `${source} failed (${status}): ${detail}`
}

export function HelpDeskContent({
  userId,
  userDepartment,
  canReviewPendingApprovals,
  initialDepartments,
  initialTickets,
  initialError,
}: HelpDeskContentProps) {
  const [tickets, setTickets] = useState<HelpDeskTicket[]>(initialTickets)
  const [isSaving, setIsSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<HelpDeskTicket[]>([])
  const [availableDepartments, setAvailableDepartments] = useState<string[]>(initialDepartments || [])
  const pendingRef = useRef<HTMLDivElement | null>(null)
  const [form, setForm] = useState({
    title: "",
    description: "",
    service_department: "IT and Communications",
    priority: "medium",
    request_type: "support",
  })

  const myOpenTickets = useMemo(
    () => tickets.filter((t) => !["resolved", "closed", "cancelled"].includes(t.status)).length,
    [tickets]
  )
  const pendingReviewCount = pendingApprovals.length

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  useEffect(() => {
    const loadSupportData = async () => {
      const pendingApprovalsPath = canReviewPendingApprovals
        ? "/api/help-desk/tickets?scope=department&status=pending_approval"
        : "/api/help-desk/tickets?scope=mine&status=pending_approval"

      const pendingRes = await fetch(pendingApprovalsPath, { cache: "no-store" })

      const pendingJson = await pendingRes.json().catch(() => ({}))

      if (pendingRes.ok) {
        setPendingApprovals(pendingJson.data || [])
      } else {
        setPendingApprovals([])
        toast.error(buildFetchDebugLabel("Pending approvals load", pendingRes.status, pendingJson))
      }
    }

    loadSupportData().catch((error) => {
      setPendingApprovals([])
      toast.error(`Failed to load help desk setup data: ${error instanceof Error ? error.message : "Unknown error"}`)
    })
  }, [canReviewPendingApprovals])

  const departmentOptions = useMemo(() => {
    const options = new Set<string>()
    options.add(form.service_department)
    for (const department of availableDepartments) {
      if (department) options.add(department)
    }
    for (const ticket of tickets) {
      if (ticket.service_department) options.add(ticket.service_department)
    }
    return Array.from(options).filter((department) => Boolean(department))
  }, [availableDepartments, form.service_department, tickets])

  useEffect(() => {
    if (form.service_department && userDepartment && form.service_department === userDepartment) {
      const fallbackDepartment = departmentOptions.find((department) => department !== userDepartment) || ""
      setForm((prev) => ({ ...prev, service_department: fallbackDepartment }))
    }
  }, [departmentOptions, form.service_department, userDepartment])

  async function refreshTickets() {
    const res = await fetch("/api/help-desk/tickets?scope=mine", { cache: "no-store" })
    const json = await res.json()
    if (!res.ok) {
      toast.error(buildFetchDebugLabel("Tickets refresh", res.status, json))
      return
    }
    setTickets(json.data || [])
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (userDepartment && form.service_department === userDepartment) {
      toast.error("You cannot submit help desk requests to your own department.")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/help-desk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Failed to create ticket")
      }

      toast.success("Ticket submitted")
      setCreateOpen(false)
      setForm({
        title: "",
        description: "",
        service_department: "IT and Communications",
        priority: "medium",
        request_type: "support",
      })
      await refreshTickets()
    } catch (error: any) {
      toast.error(error.message || "Failed to create ticket")
    } finally {
      setIsSaving(false)
    }
  }

  async function setStatus(ticketId: string, status: string) {
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Failed to update")
      }

      toast.success("Ticket updated")
      await refreshTickets()
    } catch (error: any) {
      toast.error(error.message || "Update failed")
    }
  }

  async function rateTicket(ticketId: string, rating: number) {
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csat_rating: rating }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Failed to rate")
      }

      toast.success("Thanks for your feedback")
      await refreshTickets()
    } catch (error: any) {
      toast.error(error.message || "Failed to submit rating")
    }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Help Desk"
        description="Submit and track support/procurement tickets."
        icon={Headset}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
        actions={
          <>
            {pendingReviewCount > 0 && (
              <Button
                variant="outline"
                onClick={() => pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Pending Reviews ({pendingReviewCount})
              </Button>
            )}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Submit Help Desk Ticket</DialogTitle>
                  <DialogDescription>Fill in the details and submit your ticket.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createTicket} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief summary of issue"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={form.service_department}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, service_department: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((d) => (
                          <SelectItem key={d} value={d} disabled={Boolean(userDepartment && d === userDepartment)}>
                            {d}
                            {userDepartment && d === userDepartment ? " (Your Department)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {userDepartment && (
                      <p className="text-muted-foreground text-xs">Your department ({userDepartment}) is excluded.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={form.request_type}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, request_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="procurement">Procurement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Submitting..." : "Submit Ticket"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">My Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{myOpenTickets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resolved Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">{tickets.filter((t) => t.status === "resolved").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg CSAT</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-2xl">
              {tickets.filter((t) => t.csat_rating).length
                ? (
                    tickets.filter((t) => t.csat_rating).reduce((sum, t) => sum + Number(t.csat_rating), 0) /
                    tickets.filter((t) => t.csat_rating).length
                  ).toFixed(1)
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {pendingReviewCount > 0 && (
        <Card ref={pendingRef}>
          <CardHeader>
            <CardTitle>Pending Department Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingApprovals.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{ticket.ticket_number}</p>
                  <p className="text-muted-foreground text-xs">{ticket.title}</p>
                </div>
                <Badge variant="secondary">{ticket.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="font-medium">{ticket.ticket_number}</div>
                      <div className="text-muted-foreground text-xs">{ticket.title}</div>
                    </TableCell>
                    <TableCell>{ticket.service_department}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ticket.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{ticket.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[180px] flex-wrap gap-2">
                        {ticket.assigned_to === userId && ticket.status === "assigned" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(ticket.id, "in_progress")}>
                            Start
                          </Button>
                        )}
                        {ticket.assigned_to === userId && ticket.status === "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(ticket.id, "resolved")}>
                            Resolve
                          </Button>
                        )}
                        {ticket.requester_id === userId && ticket.status === "resolved" && (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((r) => (
                              <Button
                                key={r}
                                size="sm"
                                variant="ghost"
                                onClick={() => rateTicket(ticket.id, r)}
                                title={`Rate ${r}`}
                              >
                                {r}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
