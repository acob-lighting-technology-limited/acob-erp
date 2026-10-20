"use client"

import { useEffect, useState } from "react"
import { depsChanged } from "@/lib/utils/deps-changed"
import { toast } from "sonner"
import { ArrowRight, Check, Copy, Inbox, KeyRound } from "lucide-react"
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
import type { MailboxRenameOptions } from "@/lib/employees/mailbox-rename-types"

/** The admin's answer: set up the new mailbox with these options, record-only, or cancel the save. */
export type EmailChangeChoice = { mode: "mailbox"; options: MailboxRenameOptions } | { mode: "record_only" } | null

/**
 * Asked before saving a changed company email. cPanel cannot rename a mailbox,
 * so the admin chooses whether Matrix creates the new one (and forwards the
 * old address to it) or only the employee record changes.
 */
export function EmailChangeMailboxDialog({
  request,
  onResolve,
}: {
  request: { oldEmail: string; newEmail: string; oldIsCpanel: boolean } | null
  onResolve: (choice: EmailChangeChoice) => void
}) {
  const [forwardOld, setForwardOld] = useState(true)
  const [suspendOldLogin, setSuspendOldLogin] = useState(false)

  // Reset the choices for each new request, during render rather than in an effect.
  const [seeded, setSeeded] = useState<readonly unknown[] | null>(null)
  const seededForNext = [request] as const
  if (depsChanged(seeded, seededForNext)) {
    setSeeded(seededForNext)
    if (request) {
      setForwardOld(true)
      setSuspendOldLogin(false)
    }
  }

  if (!request) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onResolve(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="text-primary h-5 w-5" />
            Company email is changing
          </DialogTitle>
          <DialogDescription>
            cPanel cannot rename a mailbox. Choose whether Matrix sets up a mailbox for the new address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-3 font-mono text-xs">
            <span className="break-all">{request.oldEmail || "(none)"}</span>
            <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold break-all">{request.newEmail}</span>
          </div>

          <p className="text-muted-foreground text-sm">
            Setting up the mailbox creates <span className="text-foreground font-mono">{request.newEmail}</span> on
            cPanel with a new password, shown to you once. The old mailbox and its mail are kept.
          </p>

          {request.oldIsCpanel && (
            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={forwardOld} onCheckedChange={(v) => setForwardOld(v === true)} className="mt-0.5" />
                <span>Forward mail sent to the old address to the new one</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={suspendOldLogin}
                  onCheckedChange={(v) => setSuspendOldLogin(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Suspend login to the old mailbox
                  <span className="text-muted-foreground block text-xs">
                    Leave this off until they have moved the mail they need.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onResolve(null)}>
            Cancel
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onResolve({ mode: "record_only" })}>
              Change record only
            </Button>
            <Button onClick={() => onResolve({ mode: "mailbox", options: { forwardOld, suspendOldLogin } })}>
              Change & set up mailbox
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Shows the new mailbox's password once, for the admin to hand over. */
export function NewMailboxPasswordDialog({
  credentials,
  onClose,
}: {
  credentials: { email: string; password: string } | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  if (!credentials) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credentials.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy password")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="text-primary h-5 w-5" />
            New mailbox password
          </DialogTitle>
          <DialogDescription>
            Give this to the employee securely. It is not stored in Matrix and will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="font-mono text-xs break-all">{credentials.email}</p>
          <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-lg border p-3">
            <span className="font-mono text-sm break-all select-all">{credentials.password}</span>
            <Button variant="ghost" size="icon" onClick={() => void copy()} aria-label="Copy password">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
