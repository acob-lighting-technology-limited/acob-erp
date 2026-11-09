"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RatingInput } from "@/components/ui/rating-input"
import { apiFetch } from "@/lib/api-client"

interface CloseTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: { id: string; ticket_number: string; title: string } | null
  onSuccess: () => void
}

export function CloseTicketDialog({ open, onOpenChange, ticket, onSuccess }: CloseTicketDialogProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleClose() {
    if (!ticket) return
    if (!rating) {
      toast.error("Please provide a service rating between 1 and 5")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch(`/api/help-desk/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "closed",
          rating,
          rating_comment: comment.trim() || null,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to close ticket")
      }

      toast.success("Ticket closed and service rating recorded")
      setRating(null)
      setComment("")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close ticket")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setRating(null)
          setComment("")
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close Ticket & Service Rating</DialogTitle>
          <DialogDescription>
            {ticket
              ? `${ticket.ticket_number} — ${ticket.title}`
              : "Rate the service provided before closing this ticket."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Service Rating (1–5) *</Label>
            <RatingInput value={rating} onChange={setRating} min={1} max={5} />
            <p className="text-muted-foreground text-xs">
              Service rating measures support quality and does not feed into employee KPI scores.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Feedback / Comment (Optional)</Label>
            <Textarea
              placeholder="Any comments on resolution quality or speed..."
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleClose} disabled={!rating || isSubmitting}>
            {isSubmitting ? "Closing..." : "Close Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
