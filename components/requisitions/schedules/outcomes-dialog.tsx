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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PinInput } from "@/components/approval-signing/pin-input"
import { apiFetch } from "@/lib/api-client"
import { formatNaira } from "@/lib/requisitions/format"
import { uploadRequisitionFiles } from "@/lib/requisitions/upload"
import type { PaymentScheduleItem } from "@/lib/requisitions/types"
import { cn } from "@/lib/utils"
import { todayInLagos } from "./schedule-status"

type Choice = "paid" | "unpaid" | "skip"

interface Row {
  choice: Choice
  reference: string
  note: string
  receipt: File | null
}

/**
 * After the MD has paid at the bank: mark each line paid (with the bank's
 * reference and receipt) or not paid (with why). Lines left alone stay waiting
 * and can be recorded later. Signed with the officer's PIN.
 */
export function OutcomesDialog({
  open,
  onOpenChange,
  scheduleId,
  items,
  setupMissing,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  items: PaymentScheduleItem[]
  setupMissing: string[]
  onDone: () => void
}) {
  const pathname = usePathname()
  const pending = items.filter((i) => i.outcome === "pending")
  // The parent mounts this only while open, so each opening starts fresh.
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(pending.map((i) => [i.id, { choice: "skip" as Choice, reference: "", note: "", receipt: null }]))
  )
  const [paidOn, setPaidOn] = useState(todayInLagos())
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)

  const set = (id: string, patch: Partial<Row>) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  const marked = pending.filter((i) => rows[i.id] && rows[i.id].choice !== "skip")

  const submit = async () => {
    if (!marked.length) return toast.error("Mark at least one line as paid or not paid")
    const missingReason = marked.find((i) => rows[i.id].choice === "unpaid" && rows[i.id].note.trim().length < 3)
    if (missingReason) return toast.error(`Say why ${missingReason.account_name} was not paid`)
    if (pin.length !== 6) return toast.error("Enter your 6-digit PIN")
    setBusy(true)
    try {
      const outcomes = []
      for (const item of marked) {
        const row = rows[item.id]
        const receiptPath =
          row.choice === "paid" && row.receipt
            ? (await uploadRequisitionFiles([row.receipt], "receipts"))[0].file_path
            : undefined
        outcomes.push({
          item_id: item.id,
          outcome: row.choice,
          bank_reference: row.reference || undefined,
          receipt_path: receiptPath,
          note: row.note || undefined,
        })
      }
      const res = await apiFetch(`/api/requisitions/schedules/${scheduleId}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid_on: paidOn, pin, outcomes }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not record the payments")
      toast.success(`${json.data.paid} paid, ${json.data.unpaid} not paid`)
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the payments")
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Record what the bank paid</DialogTitle>
          <DialogDescription>
            From the MD&rsquo;s bank receipts. Lines not paid go back for the next schedule, and the requester and
            signers are told.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Nothing is recorded until you mark it.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() =>
              setRows((prev) =>
                Object.fromEntries(
                  Object.entries(prev).map(([key, row]) => [key, { ...row, choice: "paid" as Choice }])
                )
              )
            }
          >
            Mark all {pending.length} as paid
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {pending.map((item) => {
            const row = rows[item.id]
            if (!row) return null
            return (
              <div key={item.id} className="space-y-2 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{item.account_name}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.transaction_ref} · {item.bank_name} · {item.account_number}
                    </p>
                  </div>
                  <span className="font-mono text-xs">{formatNaira(item.amount)}</span>
                </div>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="radiogroup"
                  aria-label={`Outcome for ${item.account_name}`}
                >
                  {(["paid", "unpaid", "skip"] as Choice[]).map((choice) => (
                    <Button
                      key={choice}
                      type="button"
                      size="sm"
                      variant={row.choice === choice ? "default" : "outline"}
                      className={cn(
                        "h-7 text-xs",
                        row.choice === choice && choice === "unpaid" && "bg-destructive hover:bg-destructive/90"
                      )}
                      role="radio"
                      aria-checked={row.choice === choice}
                      onClick={() => set(item.id, { choice })}
                    >
                      {choice === "paid" ? "Paid" : choice === "unpaid" ? "Not paid" : "Not known yet"}
                    </Button>
                  ))}
                </div>
                {row.choice === "paid" ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Bank reference (optional)"
                      value={row.reference}
                      onChange={(e) => set(item.id, { reference: e.target.value })}
                      aria-label={`Bank reference for ${item.account_name}`}
                    />
                    <Input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      onChange={(e) => set(item.id, { receipt: e.target.files?.[0] ?? null })}
                      aria-label={`Receipt for ${item.account_name}`}
                    />
                  </div>
                ) : row.choice === "unpaid" ? (
                  <Input
                    placeholder="Why it was not paid"
                    value={row.note}
                    onChange={(e) => set(item.id, { note: e.target.value })}
                    aria-label={`Why ${item.account_name} was not paid`}
                  />
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="outcome-date">Date paid</Label>
            <Input
              id="outcome-date"
              type="date"
              value={paidOn}
              max={todayInLagos()}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            {setupMissing.length ? (
              <p className="border-warning/30 bg-warning/10 rounded-md border p-3 text-sm">
                Set up your {setupMissing.join(" and ")} in{" "}
                <Link
                  href={`/settings/signing?return=${encodeURIComponent(pathname)}`}
                  className="font-medium underline"
                >
                  Settings → Signing
                </Link>{" "}
                first.
              </p>
            ) : (
              <>
                <Label htmlFor="outcome-pin">Approval PIN</Label>
                <PinInput id="outcome-pin" value={pin} onChange={setPin} />
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || setupMissing.length > 0 || !marked.length}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign and record {marked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
