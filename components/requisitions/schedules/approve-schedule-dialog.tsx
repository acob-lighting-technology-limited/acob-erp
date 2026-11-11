"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { PinInput } from "@/components/approval-signing/pin-input"
import { apiFetch } from "@/lib/api-client"

/** The MD signs Approved on everything on the schedule that was paid, with one PIN. */
export function ApproveScheduleDialog({
  open,
  onOpenChange,
  scheduleId,
  scheduleNumber,
  count,
  setupMissing,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  scheduleNumber: string
  count: number
  setupMissing: string[]
  onDone: () => void
}) {
  const pathname = usePathname()
  const [pin, setPin] = useState("")
  const [comments, setComments] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (pin.length !== 6) return toast.error("Enter your 6-digit PIN")
    setBusy(true)
    try {
      const res = await apiFetch(`/api/requisitions/schedules/${scheduleId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, comments: comments || undefined }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not approve")
      toast.success(`${json.data.approved.length} approved and closed`)
      onOpenChange(false)
      setPin("")
      setComments("")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve")
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve what was paid</DialogTitle>
          <DialogDescription>
            Signs Approved on the {count} paid Payment Request{count === 1 ? "" : "s"} on {scheduleNumber}. Each form
            gets your signature and is closed. Anything not paid is left out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="approve-comments">Comment (optional)</Label>
            <Textarea id="approve-comments" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>
          {setupMissing.length ? (
            <p className="border-warning/30 bg-warning/10 rounded-md border p-3 text-sm">
              Set up your {setupMissing.join(" and ")} in{" "}
              <Link href={`/settings/signing?return=${encodeURIComponent(pathname)}`} className="font-medium underline">
                Settings → Signing
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="approve-pin">Approval PIN</Label>
              <PinInput id="approve-pin" value={pin} onChange={setPin} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || setupMissing.length > 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign and approve {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
