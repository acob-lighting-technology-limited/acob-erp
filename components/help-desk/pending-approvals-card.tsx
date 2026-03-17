"use client"

import { forwardRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TicketStatusBadge } from "@/components/dashboard/help-desk/ticket-badges"
import type { HelpDeskTicket } from "./help-desk-types"

interface PendingApprovalsCardProps {
  tickets: HelpDeskTicket[]
}

export const PendingApprovalsCard = forwardRef<HTMLDivElement, PendingApprovalsCardProps>(function PendingApprovalsCard(
  { tickets },
  ref
) {
  return (
    <Card ref={ref}>
      <CardHeader>
        <CardTitle>Pending Department Reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{ticket.ticket_number}</p>
              <p className="text-muted-foreground text-xs">{ticket.title}</p>
            </div>
            <TicketStatusBadge status={ticket.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
})
