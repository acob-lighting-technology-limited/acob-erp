"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

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
}

interface HelpDeskContentProps {
  userId: string
  initialTickets: HelpDeskTicket[]
}

const departments = ["IT and Communications", "Operations", "Admin & HR", "Accounts"]

export function HelpDeskContent({ userId, initialTickets }: HelpDeskContentProps) {
  const [tickets, setTickets] = useState<HelpDeskTicket[]>(initialTickets)
  const [isSaving, setIsSaving] = useState(false)
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

  async function refreshTickets() {
    const res = await fetch("/api/help-desk/tickets?scope=mine", { cache: "no-store" })
    const json = await res.json()
    setTickets(json.data || [])
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title.trim()) {
      toast.error("Title is required")
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
    <div className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">My Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{myOpenTickets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resolved Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tickets.filter((t) => t.status === "resolved").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg CSAT</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
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

      <Card>
        <CardHeader>
          <CardTitle>Submit Help Desk Ticket</CardTitle>
        </CardHeader>
        <CardContent>
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
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Tickets</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <div className="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>
    </div>
  )
}
