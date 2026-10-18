"use client"

import { useEffect, useState } from "react"
import { depsChanged } from "@/lib/utils/deps-changed"
import { toast } from "sonner"
import { Lock, LockOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiFetch } from "@/lib/api-client"
import type { MailboxReportRow } from "@/lib/cpanel/mailboxes"

export type SuspensionTarget = { mailbox: MailboxReportRow; action: "suspend" | "restore" }

/**
 * Suspend or restore one mailbox. Suspending blocks login only by default —
 * mail keeps arriving (and can be forwarded), so nothing sent to a leaver is
 * lost. Rejecting incoming mail is an extra, deliberate tick.
 */
export function SuspensionDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: SuspensionTarget | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [rejectIncoming, setRejectIncoming] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset the choice whenever a different target is opened, during render rather than in an effect.
  const [seeded, setSeeded] = useState<readonly unknown[] | null>(null)
  const seededForNext = [target] as const
  if (depsChanged(seeded, seededForNext)) {
    setSeeded(seededForNext)
    if (target) setRejectIncoming(false)
  }

  if (!target) return null
  const { mailbox, action } = target
  const suspending = action === "suspend"

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/mailboxes/suspension", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mailbox.email, action, rejectIncoming }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to update the mailbox")
      toast.success(suspending ? `${mailbox.email} suspended` : `${mailbox.email} restored`)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update the mailbox")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {suspending ? <Lock className="h-5 w-5 text-red-500" /> : <LockOpen className="text-primary h-5 w-5" />}
            {suspending ? "Suspend mailbox" : "Restore mailbox"}
          </DialogTitle>
          <DialogDescription className="break-all">
            {mailbox.email}
            {mailbox.owner ? ` · ${mailbox.owner.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {suspending ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium">Login will be blocked</span> — webmail, phone and Outlook stop working, and
              they can no longer send mail. Mail sent to them <span className="font-medium">still arrives</span>, so
              nothing is lost.
            </p>
            {!mailbox.suspendedIncoming && (
              <label className="flex items-start gap-2 rounded-lg border p-3">
                <Checkbox
                  checked={rejectIncoming}
                  onCheckedChange={(v) => setRejectIncoming(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Also reject incoming mail
                  <span className="text-muted-foreground block text-xs">
                    Senders get a bounce. Only for a mailbox nobody will ever need again.
                  </span>
                </span>
              </label>
            )}
          </div>
        ) : (
          <p className="text-sm">
            Login {mailbox.suspendedIncoming ? "and incoming mail are" : "is"} restored. The owner can sign in again
            with their existing password.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant={suspending ? "destructive" : "default"} onClick={() => void save()} loading={saving}>
            {suspending ? "Suspend" : "Restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
