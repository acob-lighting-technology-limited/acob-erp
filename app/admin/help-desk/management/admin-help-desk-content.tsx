"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface HelpDeskTicket {
  id: string
  ticket_number: string
  title: string
  service_department: string
  priority: "low" | "medium" | "high" | "urgent"
  status: string
  assigned_to: string | null
  request_type: "support" | "procurement"
  sla_target_at: string | null
}

interface EmployeeOption {
  id: string
  first_name: string
  last_name: string
  department: string | null
}

interface AdminHelpDeskContentProps {
  initialTickets: HelpDeskTicket[]
  employees: EmployeeOption[]
}

export function AdminHelpDeskContent({ initialTickets, employees }: AdminHelpDeskContentProps) {
  const [tickets, setTickets] = useState(initialTickets)
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string>>({})
  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const now = Date.now()
    const breached = tickets.filter(
      (t) => t.sla_target_at && new Date(t.sla_target_at).getTime() < now && !["resolved", "closed"].includes(t.status)
    ).length

    return {
      total: tickets.length,
      pendingApproval: tickets.filter((t) => t.status === "pending_approval").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      breached,
    }
  }, [tickets])

  async function refresh() {
    const res = await fetch("/api/help-desk/tickets?scope=department", { cache: "no-store" })
    const json = await res.json()
    setTickets(json.data || [])
  }

  async function assign(ticketId: string) {
    const assignedTo = assignmentMap[ticketId]
    if (!assignedTo) {
      toast.error("Choose a staff member first")
      return
    }

    setLoadingTicketId(ticketId)
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: assignedTo }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Assignment failed")
      }

      toast.success("Ticket assigned")
      await refresh()
    } catch (error: any) {
      toast.error(error.message || "Assignment failed")
    } finally {
      setLoadingTicketId(null)
    }
  }

  async function pivot(ticketId: string) {
    setLoadingTicketId(ticketId)
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}/pivot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Requires procurement support" }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Pivot failed")
      }

      toast.success("Ticket moved to procurement approval")
      await refresh()
    } catch (error: any) {
      toast.error(error.message || "Pivot failed")
    } finally {
      setLoadingTicketId(null)
    }
  }

  async function approve(ticketId: string, decision: "approved" | "rejected") {
    setLoadingTicketId(ticketId)
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Decision failed")
      }

      toast.success(decision === "approved" ? "Approval recorded" : "Rejection recorded")
      await refresh()
    } catch (error: any) {
      toast.error(error.message || "Decision failed")
    } finally {
      setLoadingTicketId(null)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.pendingApproval}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SLA Breached</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.breached}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Help Desk Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assign</TableHead>
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
                    <div className="flex items-center gap-2">
                      <Select
                        value={assignmentMap[ticket.id] || ""}
                        onValueChange={(value) => setAssignmentMap((prev) => ({ ...prev, [ticket.id]: value }))}
                      >
                        <SelectTrigger className="w-[190px]">
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter((e) => !e.department || e.department === ticket.service_department)
                            .map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.first_name} {employee.last_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => assign(ticket.id)} disabled={loadingTicketId === ticket.id}>
                        Assign
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {(ticket.status === "in_progress" || ticket.status === "assigned") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pivot(ticket.id)}
                          disabled={loadingTicketId === ticket.id}
                        >
                          Pivot
                        </Button>
                      )}
                      {ticket.status === "pending_approval" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approve(ticket.id, "approved")}
                            disabled={loadingTicketId === ticket.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => approve(ticket.id, "rejected")}
                            disabled={loadingTicketId === ticket.id}
                          >
                            Reject
                          </Button>
                        </>
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
