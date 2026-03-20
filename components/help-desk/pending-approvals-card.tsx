"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TicketStatusBadge } from "@/components/dashboard/help-desk/ticket-badges"
import type { HelpDeskTicket } from "./help-desk-types"

interface PendingApprovalsCardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tickets: HelpDeskTicket[]
}

export function PendingApprovalsCard({ open, onOpenChange, tickets }: PendingApprovalsCardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pending Department Reviews</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">{ticket.ticket_number}</p>
                <p className="text-muted-foreground text-xs">{ticket.title}</p>
              </div>
              <TicketStatusBadge status={ticket.status} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
