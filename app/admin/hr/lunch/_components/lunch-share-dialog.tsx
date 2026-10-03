"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import { Copy, MessageCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { buildLunchWhatsAppMessage } from "@/lib/hr/lunch-share"

interface LunchShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  menu: { date: string; resolvedDeadline: string; votingOpen: boolean } | null
  todayDate: string
}

/**
 * Hands HR the finished WhatsApp post for a menu — greeting, caption, deadline
 * and the dated link that previews the dishes (see lib/hr/lunch-share.ts) — so
 * nobody has to build or edit the link by hand. Opened straight after a menu
 * is published, and from the menu row's "Share to WhatsApp" action.
 */
export function LunchShareDialog({ open, onOpenChange, menu, todayDate }: LunchShareDialogProps) {
  // Rebuilt each time the dialog opens so the greeting matches the time of posting.
  const message = useMemo(
    () =>
      open && menu
        ? buildLunchWhatsAppMessage({
            date: menu.date,
            today: todayDate,
            deadline: menu.resolvedDeadline,
            votingOpen: menu.votingOpen,
            origin: window.location.origin,
          })
        : "",
    [open, menu, todayDate]
  )

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      toast.success("Message copied — paste it into the WhatsApp group.")
    } catch {
      toast.error("Couldn't copy the message. Select the text above and copy it instead.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share to WhatsApp</DialogTitle>
          <DialogDescription>
            Send this to the staff group. The link shows the menu in WhatsApp before anyone opens it.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-md border p-3 text-sm break-words whitespace-pre-wrap select-all">
          {message}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => void copyMessage()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy message
          </Button>
          <Button asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Send on WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
