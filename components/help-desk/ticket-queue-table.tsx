"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PriorityBadge, TicketStatusBadge } from "@/components/dashboard/help-desk/ticket-badges"
import { isAssignableProfile } from "@/lib/workforce/assignment-policy"

export interface HelpDeskTicket {
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

export interface EmployeeOption {
  id: string
  first_name: string
  last_name: string
  department: string | null
  employment_status?: string | null
}

export interface LeadDirectoryMember {
  id: string
  full_name: string
  role: string
  department: string | null
  lead_departments: string[]
}

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

export function resolveCurrentStage(ticket: HelpDeskTicket) {
  if (ticket.status === "pending_approval") return stageLabel(ticket.current_approval_stage)
  if (ticket.status === "new") return "Intake"
  if (ticket.status === "pending_lead_review") return "Lead Approval"
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

export function resolveApproverName(ticket: HelpDeskTicket, leadDirectory: LeadDirectoryMember[]) {
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

interface TicketQueueTableProps {
  rows: HelpDeskTicket[]
  includeActions?: boolean
  leadDirectory: LeadDirectoryMember[]
  employees: EmployeeOption[]
  assignmentMap: Record<string, string>
  onAssignmentChange: (ticketId: string, value: string) => void
  loadingTicketId: string | null
  viewerId: string
  myActionQueueIds: Set<string>
  canAssignTicket: (ticket: HelpDeskTicket) => boolean
  onAssign: (ticketId: string) => void
  onRouteTicket: (ticketId: string, action: "send_to_queue" | "assign_department" | "assign_me") => void
  onPivot: (ticketId: string) => void
  onApprove: (ticketId: string, decision: "approved" | "rejected") => void
}

export function TicketQueueTable({
  rows,
  includeActions = false,
  leadDirectory,
  employees,
  assignmentMap,
  onAssignmentChange,
  loadingTicketId,
  viewerId,
  myActionQueueIds,
  canAssignTicket,
  onAssign,
  onRouteTicket,
  onPivot,
  onApprove,
}: TicketQueueTableProps) {
  return (
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
              <PriorityBadge priority={ticket.priority} />
            </TableCell>
            <TableCell>
              <TicketStatusBadge status={ticket.status} />
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
                      onValueChange={(value) => onAssignmentChange(ticket.id, value)}
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
                    <Button size="sm" onClick={() => onAssign(ticket.id)} disabled={loadingTicketId === ticket.id}>
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
                        onClick={() => onRouteTicket(ticket.id, "send_to_queue")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Send to Queue
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRouteTicket(ticket.id, "assign_department")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Assign to Dept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRouteTicket(ticket.id, "assign_me")}
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
                        onClick={() => onRouteTicket(ticket.id, "assign_me")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Claim
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRouteTicket(ticket.id, "assign_department")}
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
                      onClick={() => onRouteTicket(ticket.id, "send_to_queue")}
                      disabled={loadingTicketId === ticket.id}
                    >
                      Reopen Queue
                    </Button>
                  )}
                  {(ticket.status === "in_progress" || ticket.status === "assigned") &&
                    ticket.assigned_to === viewerId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPivot(ticket.id)}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Pivot
                      </Button>
                    )}
                  {ticket.status === "pending_approval" && myActionQueueIds.has(ticket.id) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onApprove(ticket.id, "approved")}
                        disabled={loadingTicketId === ticket.id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onApprove(ticket.id, "rejected")}
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
}
