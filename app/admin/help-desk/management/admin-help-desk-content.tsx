"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { Headset, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import { isAssignableProfile } from "@/lib/workforce/assignment-policy"

interface HelpDeskTicket {
  id: string
  ticket_number: string
  title: string
  requester_department: string | null
  service_department: string
  priority: "low" | "medium" | "high" | "urgent"
  status: string
  handling_mode: "individual" | "queue" | "department" | null
  current_approval_stage: string | null
  assigned_to: string | null
  request_type: "support" | "procurement"
  sla_target_at: string | null
}

interface EmployeeOption {
  id: string
  first_name: string
  last_name: string
  department: string | null
  employment_status?: string | null
}

interface LeadDirectoryMember {
  id: string
  full_name: string
  role: string
  department: string | null
  lead_departments: string[]
}

interface AdminHelpDeskContentProps {
  initialTickets: HelpDeskTicket[]
  employees: EmployeeOption[]
  leadDirectory: LeadDirectoryMember[]
  viewer: {
    id: string
    role: string
    department: string | null
    is_department_lead: boolean
    lead_departments: string[]
    managed_departments: string[]
  }
}

const FINAL_STATUSES = new Set(["resolved", "closed", "cancelled", "rejected"])

function stageLabel(stage: string | null) {
  if (!stage) return "-"
  if (stage === "department_lead") return "Lead Approval"
  if (stage === "requester_department_lead") return "Lead Approval"
  if (stage === "service_department_lead") return "Lead Approval"
  if (stage === "head_corporate_services") return "HCS Approval"
  if (stage === "managing_director") return "MD Approval"
  return stage.replaceAll("_", " ")
}

function managesDepartment(
  member: { department: string | null; lead_departments: string[] },
  department: string | null
) {
  if (!department) return false
  return member.department === department || member.lead_departments.includes(department)
}

function resolveCurrentStage(ticket: HelpDeskTicket) {
  if (ticket.status === "pending_approval") {
    return stageLabel(ticket.current_approval_stage)
  }
  if (ticket.status === "new") return "Intake"
  if (ticket.status === "pending_lead_review") {
    return "Lead Approval"
  }
  if (ticket.status === "department_queue") return "Queue Handling"
  if (ticket.status === "department_assigned") return "Department Execution"
  if (ticket.status === "assigned" || ticket.status === "in_progress") return "Execution"
  if (ticket.status === "approved_for_procurement") return "Procurement Approved"
  if (ticket.status === "rejected") return "Rejected"
  if (ticket.status === "resolved") return "Resolved"
  if (ticket.status === "closed") return "Closed"
  if (ticket.status === "cancelled") return "Cancelled"
  return "-"
}

function resolveApproverName(ticket: HelpDeskTicket, leadDirectory: LeadDirectoryMember[]) {
  const getLeadName = (department: string | null, fallbackScope: string) => {
    const approver = leadDirectory.find((member) => managesDepartment(member, department))
    if (approver?.full_name?.trim()) return approver.full_name
    return `No lead assigned (${fallbackScope})`
  }

  if (ticket.status === "pending_approval") {
    if (ticket.current_approval_stage === "department_lead") {
      return getLeadName(ticket.service_department, ticket.service_department || "service department")
    }
    if (ticket.current_approval_stage === "requester_department_lead") {
      return getLeadName(ticket.requester_department, ticket.requester_department || "requester department")
    }
    if (ticket.current_approval_stage === "service_department_lead") {
      return getLeadName(ticket.service_department, ticket.service_department || "service department")
    }
    if (ticket.current_approval_stage === "head_corporate_services") {
      return getLeadName("Corporate Services", "Corporate Services")
    }
    if (ticket.current_approval_stage === "managing_director") {
      return getLeadName("Executive Management", "Executive Management")
    }
    return stageLabel(ticket.current_approval_stage)
  }
  if (ticket.status === "pending_lead_review") {
    return getLeadName(ticket.service_department, ticket.service_department || "service department")
  }
  if (ticket.status === "department_queue") return "-"
  if (ticket.status === "new") return "Pending Triage"
  if (ticket.status === "department_assigned" || ticket.status === "assigned" || ticket.status === "in_progress")
    return "Assigned Staff"
  return "-"
}

export function AdminHelpDeskContent({ initialTickets, employees, leadDirectory, viewer }: AdminHelpDeskContentProps) {
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

  const managedDepartments = viewer.managed_departments || viewer.lead_departments || []
  const canLeadDepartment = (department: string | null) =>
    Boolean(viewer.is_department_lead && department && managedDepartments.includes(department))

  const allPendingTickets = useMemo(() => tickets.filter((ticket) => !FINAL_STATUSES.has(ticket.status)), [tickets])
  const historyTickets = useMemo(() => tickets.filter((ticket) => FINAL_STATUSES.has(ticket.status)), [tickets])

  const myActionQueue = useMemo(() => {
    return allPendingTickets.filter((ticket) => {
      if (ticket.status === "pending_approval") {
        if (ticket.current_approval_stage === "department_lead") {
          return canLeadDepartment(ticket.service_department)
        }
        if (ticket.current_approval_stage === "requester_department_lead") {
          return canLeadDepartment(ticket.requester_department)
        }
        if (ticket.current_approval_stage === "service_department_lead") {
          return canLeadDepartment(ticket.service_department)
        }
        if (ticket.current_approval_stage === "head_corporate_services") {
          return canLeadDepartment("Corporate Services")
        }
        if (ticket.current_approval_stage === "managing_director") {
          return canLeadDepartment("Executive Management")
        }
      }

      if (ticket.status === "pending_lead_review" || ticket.status === "department_queue") {
        return canLeadDepartment(ticket.service_department)
      }

      return ticket.assigned_to === viewer.id
    })
  }, [allPendingTickets, managedDepartments, viewer.id, viewer.is_department_lead])

  const canAssignTicket = (ticket: HelpDeskTicket) => {
    if (!canLeadDepartment(ticket.service_department)) return false
    return ["new", "pending_lead_review", "department_queue", "department_assigned"].includes(ticket.status)
  }

  async function refresh() {
    const res = await fetch("/api/help-desk/tickets?scope=department", { cache: "no-store" })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json?.error || "Failed to refresh help desk queue")
      return
    }
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
        body: JSON.stringify({ action: "assign_staff", assigned_to: assignedTo }),
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

  async function routeTicket(ticketId: string, action: "send_to_queue" | "assign_department" | "assign_me") {
    setLoadingTicketId(ticketId)
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Routing failed")
      }

      toast.success("Ticket updated")
      await refresh()
    } catch (error: any) {
      toast.error(error.message || "Routing failed")
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

  const renderQueueTable = (rows: HelpDeskTicket[], includeActions = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">S/N</TableHead>
          <TableHead>Ticket</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Current Stage</TableHead>
          <TableHead>Current Approver</TableHead>
          {includeActions && <TableHead>Assign</TableHead>}
          {includeActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((ticket, index) => (
          <TableRow key={ticket.id}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>
              <div className="font-medium">{ticket.ticket_number}</div>
              <div className="text-muted-foreground text-xs">{ticket.title}</div>
              <div className="text-muted-foreground mt-1 text-[11px]">
                {ticket.request_type} | requester: {ticket.requester_department || "-"} | service:{" "}
                {ticket.service_department}
              </div>
            </TableCell>
            <TableCell>{ticket.service_department}</TableCell>
            <TableCell>
              <Badge variant="outline">{ticket.priority}</Badge>
            </TableCell>
            <TableCell>
              <Badge>{ticket.status}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{resolveCurrentStage(ticket)}</Badge>
            </TableCell>
            <TableCell>{resolveApproverName(ticket, leadDirectory)}</TableCell>
            {includeActions && (
              <TableCell>
                {canAssignTicket(ticket) ? (
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
                          .filter(
                            (employee) =>
                              isAssignableProfile(employee, { allowLegacyNullStatus: false }) &&
                              (!employee.department || employee.department === ticket.service_department)
                          )
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
                ) : (
                  <span className="text-muted-foreground text-xs">Not assignable at this stage</span>
                )}
              </TableCell>
            )}
            {includeActions && (
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {ticket.status === "pending_lead_review" && canAssignTicket(ticket) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => routeTicket(ticket.id, "send_to_queue")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Send to Queue
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => routeTicket(ticket.id, "assign_department")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Assign to Dept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => routeTicket(ticket.id, "assign_me")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Assign to Me
                      </Button>
                    </>
                  )}
                  {ticket.status === "department_queue" && canAssignTicket(ticket) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => routeTicket(ticket.id, "assign_me")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Claim
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => routeTicket(ticket.id, "assign_department")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Assign to Dept
                      </Button>
                    </>
                  )}
                  {ticket.status === "department_assigned" && canAssignTicket(ticket) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => routeTicket(ticket.id, "send_to_queue")}
                      disabled={loadingTicketId === ticket.id}
                    >
                      Reopen Queue
                    </Button>
                  )}
                  {(ticket.status === "in_progress" || ticket.status === "assigned") &&
                    ticket.assigned_to === viewer.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pivot(ticket.id)}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Pivot
                      </Button>
                    )}
                  {ticket.status === "pending_approval" && myActionQueue.some((row) => row.id === ticket.id) && (
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
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <AdminTablePage
      title="Help Desk Workflow"
      description="Manage ticket routing, approvals, and escalations."
      icon={Headset}
      backLinkHref="/admin"
      backLinkLabel="Back to Admin"
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
          <StatCard title="Total Tickets" value={stats.total} icon={Headset} />
          <StatCard title="In Progress" value={stats.inProgress} icon={Clock} />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApproval}
            icon={AlertCircle}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600 dark:text-orange-400"
          />
          <StatCard
            title="SLA Breached"
            value={stats.breached}
            icon={CheckCircle2}
            iconBgColor="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
          />
        </div>
      }
    >
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending Queue ({allPendingTickets.length})</TabsTrigger>
          <TabsTrigger value="history">History ({historyTickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Pending Help Desk Workflow</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {allPendingTickets.length === 0 ? (
                <EmptyState title="No pending tickets" description="New pending workflow tickets will appear here." />
              ) : (
                renderQueueTable(allPendingTickets, false)
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My Action Queue</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {myActionQueue.length === 0 ? (
                <EmptyState
                  title="No tickets assigned to you"
                  description="Your actionable queue is currently empty."
                />
              ) : (
                renderQueueTable(myActionQueue, true)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Help Desk History</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {historyTickets.length === 0 ? (
                <EmptyState title="No history tickets" description="Resolved and closed tickets will appear here." />
              ) : (
                renderQueueTable(historyTickets, false)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminTablePage>
  )
}
