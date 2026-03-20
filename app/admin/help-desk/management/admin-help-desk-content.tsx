"use client"

import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { PromptDialog } from "@/components/ui/prompt-dialog"
import { Headset, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import { TicketQueueTable } from "@/components/help-desk/ticket-queue-table"
import type { HelpDeskTicket, EmployeeOption, LeadDirectoryMember } from "@/components/help-desk/ticket-queue-table"

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function AdminHelpDeskContent({ initialTickets, employees, leadDirectory, viewer }: AdminHelpDeskContentProps) {
  const [tickets, setTickets] = useState(initialTickets)
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string>>({})
  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null)
  const [approvalPrompt, setApprovalPrompt] = useState<{ ticketId: string; decision: "approved" | "rejected" } | null>(
    null
  )

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

  const managedDepartments = useMemo(
    () =>
      (Array.isArray(viewer.managed_departments) && viewer.managed_departments.length > 0
        ? viewer.managed_departments
        : viewer.lead_departments) || [],
    [viewer.lead_departments, viewer.managed_departments]
  )

  const canLeadDepartment = useCallback(
    (department: string | null) =>
      Boolean(viewer.is_department_lead && department && managedDepartments.includes(department)),
    [managedDepartments, viewer.is_department_lead]
  )

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
  }, [allPendingTickets, canLeadDepartment, viewer.id])

  const myActionQueueIds = useMemo(() => new Set(myActionQueue.map((t) => t.id)), [myActionQueue])

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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Assignment failed"))
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Routing failed"))
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Pivot failed"))
    } finally {
      setLoadingTicketId(null)
    }
  }

  async function approve(ticketId: string, decision: "approved" | "rejected") {
    setApprovalPrompt({ ticketId, decision })
  }

  async function submitApproval(comments: string) {
    if (!approvalPrompt) return

    const { ticketId, decision } = approvalPrompt
    setLoadingTicketId(ticketId)
    try {
      const res = await fetch(`/api/help-desk/tickets/${ticketId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments: comments || null }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Decision failed")
      }
      toast.success(decision === "approved" ? "Approval recorded" : "Rejection recorded")
      await refresh()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Decision failed"))
    } finally {
      setLoadingTicketId(null)
      setApprovalPrompt(null)
    }
  }

  const sharedTableProps = {
    leadDirectory,
    employees,
    assignmentMap,
    onAssignmentChange: (ticketId: string, value: string) =>
      setAssignmentMap((prev) => ({ ...prev, [ticketId]: value })),
    loadingTicketId,
    viewerId: viewer.id,
    myActionQueueIds,
    canAssignTicket,
    onAssign: assign,
    onRouteTicket: routeTicket,
    onPivot: pivot,
    onApprove: approve,
  }

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
                <TicketQueueTable rows={allPendingTickets} includeActions={false} {...sharedTableProps} />
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
                <TicketQueueTable rows={myActionQueue} includeActions={true} {...sharedTableProps} />
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
                <TicketQueueTable rows={historyTickets} includeActions={false} {...sharedTableProps} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PromptDialog
        open={approvalPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setApprovalPrompt(null)
        }}
        title={approvalPrompt?.decision === "rejected" ? "Why are you rejecting this ticket?" : "Approval note"}
        description="Add a note so the requester and team can understand this approval action."
        label="Approver note"
        placeholder="Write a short explanation..."
        inputType="textarea"
        required={approvalPrompt?.decision === "rejected"}
        confirmLabel="Submit decision"
        confirmVariant={approvalPrompt?.decision === "rejected" ? "destructive" : "default"}
        onConfirm={submitApproval}
      />
    </AdminTablePage>
  )
}
