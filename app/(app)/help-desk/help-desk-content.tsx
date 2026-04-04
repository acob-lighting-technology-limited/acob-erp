"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MyTicketsTable } from "@/components/dashboard/help-desk/my-tickets-table"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Headset } from "lucide-react"
import { HelpDeskStats } from "@/components/help-desk/help-desk-stats"
import { PendingApprovalsCard } from "@/components/help-desk/pending-approvals-card"
import { CreateTicketDialog, type CreateTicketForm } from "@/components/help-desk/create-ticket-dialog"
import type { HelpDeskTicket, HelpDeskContentProps } from "@/components/help-desk/help-desk-types"

type ErrorPayload = {
  error?: string
  message?: string
}

function buildFetchDebugLabel(source: string, status: number, payload: unknown) {
  const p = payload as ErrorPayload
  const detail = p?.error || p?.message || (typeof payload === "string" ? payload : "") || "Unknown error"
  return `${source} failed (${status}): ${detail}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function HelpDeskContent({
  userId,
  userDepartment,
  canReviewPendingApprovals,
  initialDepartments,
  initialTickets,
  initialError,
}: HelpDeskContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tickets, setTickets] = useState<HelpDeskTicket[]>(initialTickets)
  const [isSaving, setIsSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [availableDepartments] = useState<string[]>(initialDepartments || [])
  const [pendingApprovalsOpen, setPendingApprovalsOpen] = useState(false)
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateTicketForm>({
    title: "",
    description: "",
    service_department: "IT and Communications",
    priority: "medium",
    request_type: "support",
  })

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  const pendingApprovalsPath = canReviewPendingApprovals
    ? "/api/help-desk/tickets?scope=department&status=pending_approval"
    : "/api/help-desk/tickets?scope=mine&status=pending_approval"

  const { data: pendingApprovalsData } = useQuery({
    queryKey: QUERY_KEYS.tickets({
      scope: canReviewPendingApprovals ? "department" : "mine",
      status: "pending_approval",
    }),
    queryFn: async () => {
      const res = await fetch(pendingApprovalsPath, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(buildFetchDebugLabel("Pending approvals load", res.status, json))
      return json.data || []
    },
  })
  const pendingApprovals: HelpDeskTicket[] = pendingApprovalsData || []

  const myOpenTickets = useMemo(
    () => tickets.filter((t) => !["resolved", "closed", "cancelled"].includes(t.status)).length,
    [tickets]
  )
  const pendingReviewCount = pendingApprovals.length

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

  const avgCsat = useMemo(() => {
    const rated = tickets.filter((t) => t.csat_rating)
    if (!rated.length) return "-"
    return (rated.reduce((sum, t) => sum + Number(t.csat_rating), 0) / rated.length).toFixed(1)
  }, [tickets])

  async function refreshTickets() {
    const res = await fetch("/api/help-desk/tickets?scope=mine", { cache: "no-store" })
    const json = await res.json()
    if (!res.ok) {
      toast.error(buildFetchDebugLabel("Tickets refresh", res.status, json))
      return
    }
    setTickets(json.data || [])
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.tickets({
        scope: canReviewPendingApprovals ? "department" : "mine",
        status: "pending_approval",
      }),
    })
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create ticket"))
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Update failed"))
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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to submit rating"))
    }
  }

  async function openTicketDetails(ticketId: string) {
    router.push(`/help-desk/${ticketId}`)
  }

  async function decideApproval(ticketId: string, decision: "approved" | "rejected") {
    setProcessingApprovalId(ticketId)
    try {
      const response = await fetch(`/api/help-desk/tickets/${ticketId}/approvals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to process approval")
      toast.success(`Ticket ${decision === "approved" ? "approved" : "rejected"}`)
      await refreshTickets()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to process approval"))
    } finally {
      setProcessingApprovalId(null)
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
              <Button variant="outline" onClick={() => setPendingApprovalsOpen(true)}>
                Pending Reviews ({pendingReviewCount})
              </Button>
            )}
            <CreateTicketDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              form={form}
              onFormChange={setForm}
              onSubmit={createTicket}
              isSaving={isSaving}
              departmentOptions={departmentOptions}
              userDepartment={userDepartment}
            />
          </>
        }
      />

      <HelpDeskStats
        myOpenTickets={myOpenTickets}
        resolvedCount={tickets.filter((t) => t.status === "resolved").length}
        avgCsat={avgCsat}
      />

      {pendingReviewCount > 0 && (
        <PendingApprovalsCard
          open={pendingApprovalsOpen}
          onOpenChange={setPendingApprovalsOpen}
          tickets={pendingApprovals}
          processingId={processingApprovalId}
          onDecision={decideApproval}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <MyTicketsTable
            tickets={tickets}
            userId={userId}
            onSetStatus={setStatus}
            onRateTicket={rateTicket}
            onViewTicket={openTicketDetails}
          />
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
