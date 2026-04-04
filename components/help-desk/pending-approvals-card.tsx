"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TicketStatusBadge } from "@/components/dashboard/help-desk/ticket-badges"
import { Button } from "@/components/ui/button"
import type { HelpDeskTicket } from "./help-desk-types"

interface PendingApprovalsCardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tickets: HelpDeskTicket[]
  processingId?: string | null
  onDecision?: (ticketId: string, decision: "approved" | "rejected") => void
}

export function PendingApprovalsCard({
  open,
  onOpenChange,
  tickets,
  processingId,
  onDecision,
}: PendingApprovalsCardProps) {
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
              <div className="flex items-center gap-2">
                <TicketStatusBadge status={ticket.status} />
                {onDecision ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processingId === ticket.id}
                      onClick={() => onDecision(ticket.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={processingId === ticket.id}
                      onClick={() => onDecision(ticket.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
