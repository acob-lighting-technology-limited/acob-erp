"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { todayInLagos } from "./schedule-status"

/** Start a draft payment schedule; payments are added on its own page. */
export function NewScheduleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const [paymentDate, setPaymentDate] = useState(todayInLagos())
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const res = await apiFetch("/api/requisitions/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_date: paymentDate, note: note || undefined }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not start the schedule")
      toast.success(`Schedule ${json.data.schedule_number} started`)
      onOpenChange(false)
      setNote("")
      onCreated(json.data.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the schedule")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New payment schedule</DialogTitle>
          <DialogDescription>
            A batch of verified Payment Requests for the MD to pay at the bank. You add the payments next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-date">Payment date</Label>
            <Input
              id="schedule-date"
              type="date"
              value={paymentDate}
              min={todayInLagos()}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">The due date written on every line of the bank file.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-note">Note (optional)</Label>
            <Textarea id="schedule-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !paymentDate}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
