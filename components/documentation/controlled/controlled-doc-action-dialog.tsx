"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import { type ControlledDocRow } from "@/lib/documentation/controlled"

export type ControlledDocAction = "publish" | "retire" | "delete"

const COPY: Record<ControlledDocAction, { title: string; confirm: string; destructive: boolean }> = {
  publish: { title: "Publish document?", confirm: "Publish", destructive: false },
  retire: { title: "Retire document?", confirm: "Retire", destructive: true },
  delete: { title: "Delete draft?", confirm: "Delete Draft", destructive: true },
}

function describe(action: ControlledDocAction, doc: ControlledDocRow): string {
  if (action === "publish") {
    if (doc.retired_at) return "It becomes visible to its audience again. Nobody is re-notified."
    return doc.doc_type === "policy"
      ? "All active staff will see it, get a notification, and be asked to acknowledge it."
      : "Its audience will see it and get a notification."
  }
  if (action === "retire") {
    return "Staff will no longer see it. Its versions and acknowledgement records are kept, and you can publish it again later."
  }
  return "The draft and its uploaded file are removed. This can't be undone."
}

interface ControlledDocActionDialogProps {
  action: ControlledDocAction | null
  doc: ControlledDocRow | null
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

export function ControlledDocActionDialog({ action, doc, onOpenChange, onDone }: ControlledDocActionDialogProps) {
  const [isWorking, setIsWorking] = useState(false)
  const open = action !== null && doc !== null

  async function run() {
    if (!action || !doc) return
    setIsWorking(true)
    try {
      const res =
        action === "delete"
          ? await apiFetch(`/api/documentation/controlled/${doc.id}`, { method: "DELETE" })
          : await apiFetch(`/api/documentation/controlled/${doc.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(payload.error || "Action failed")
      toast.success(
        action === "publish"
          ? `${doc.reference_code} published`
          : action === "retire"
            ? `${doc.reference_code} retired`
            : "Draft deleted"
      )
      onDone()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
    } finally {
      setIsWorking(false)
    }
  }

  const copy = action ? COPY[action] : null

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isWorking && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="text-foreground font-medium">
              {doc?.reference_code} · {doc?.title}
            </span>
            <br />
            {action && doc ? describe(action, doc) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
          <Button
            variant={copy?.destructive ? "destructive" : "default"}
            onClick={() => void run()}
            disabled={isWorking}
          >
            {copy?.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
