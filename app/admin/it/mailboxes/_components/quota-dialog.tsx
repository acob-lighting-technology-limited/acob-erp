"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MailboxUsageBar } from "@/components/mailbox/mailbox-usage-bar"
import { apiFetch } from "@/lib/api-client"
import { MAILBOX_QUOTA_STEPS_MB, formatBytes, formatQuota, nextQuotaStepMb } from "@/lib/cpanel/quota"
import type { MailboxReportRow } from "@/lib/cpanel/mailboxes"

const MB = 1024 * 1024

/** Change one mailbox's quota on cPanel, after the admin confirms the new size. */
export function QuotaDialog({
  mailbox,
  onOpenChange,
  onSaved,
}: {
  mailbox: MailboxReportRow | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [quotaMb, setQuotaMb] = useState<number>(1024)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mailbox) setQuotaMb(nextQuotaStepMb(mailbox.quotaBytes))
  }, [mailbox])

  if (!mailbox) return null

  const currentMb = mailbox.quotaBytes == null ? null : Math.round(mailbox.quotaBytes / MB)
  const belowUsage = quotaMb * MB < mailbox.usedBytes
  const unchanged = currentMb === quotaMb

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/mailboxes/quota", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mailbox.email, quotaMb }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to change the quota")
      toast.success(`${mailbox.email} quota set to ${formatBytes(quotaMb * MB)}`)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change the quota")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="text-primary h-5 w-5" />
            Change mailbox quota
          </DialogTitle>
          <DialogDescription className="break-all">{mailbox.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <MailboxUsageBar
            usedBytes={mailbox.usedBytes}
            quotaBytes={mailbox.quotaBytes}
            usedPercent={mailbox.usedPercent}
          />

          <div className="space-y-2">
            <Label htmlFor="mailbox-quota">New quota</Label>
            <Select value={String(quotaMb)} onValueChange={(v) => setQuotaMb(Number(v))}>
              <SelectTrigger id="mailbox-quota">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAILBOX_QUOTA_STEPS_MB.map((step) => (
                  <SelectItem key={step} value={String(step)}>
                    {formatBytes(step * MB)}
                    {step === currentMb ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {belowUsage && (
              <p className="text-danger text-xs">
                This is less than the {formatBytes(mailbox.usedBytes)} already stored — the mailbox would be over quota
                and start rejecting mail.
              </p>
            )}
          </div>

          <p className="text-muted-foreground text-sm">
            {formatQuota(mailbox.quotaBytes)} →{" "}
            <span className="text-foreground font-medium">{formatBytes(quotaMb * MB)}</span>. The change applies on
            cPanel immediately.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || unchanged || belowUsage}>
            {saving ? "Saving…" : "Confirm change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
