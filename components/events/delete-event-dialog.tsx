"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { CalendarEvent } from "@/lib/events/types"
import { deleteEvent } from "./use-events"

export function DeleteEventDialog({
  event,
  onOpenChange,
  onDeleted,
}: {
  event: CalendarEvent | null
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)

  const confirm = async () => {
    if (!event) return
    setDeleting(true)
    try {
      await deleteEvent(event.id)
      toast.success("Event deleted")
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events() })
      onDeleted?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={event !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this event?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{event?.title}&rdquo; and its invite list will be removed for everyone. To keep a record, set the
            status to Cancelled instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Keep event</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete event"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
