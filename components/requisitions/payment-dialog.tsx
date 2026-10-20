"use client"

import { useEffect, useState } from "react"
import { depsChanged } from "@/lib/utils/deps-changed"
import Link from "next/link"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PinInput } from "@/components/approval-signing/pin-input"
import { apiFetch } from "@/lib/api-client"
import { formatNaira } from "@/lib/requisitions/format"
import { uploadRequisitionFiles } from "@/lib/requisitions/upload"
import type { Requisition, RequisitionViewerActions } from "@/lib/requisitions/types"

function todayInLagos() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })
}

/** Processed By: record a payment. Defaults to the full outstanding amount. */
export function PaymentDialog({
  open,
  onOpenChange,
  requisition,
  viewer,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requisition: Requisition
  viewer: RequisitionViewerActions
  onDone: () => void
}) {
  const outstanding = Math.round((Number(requisition.amount) - Number(requisition.amount_paid)) * 100) / 100
  const [amount, setAmount] = useState("")
  const [paidOn, setPaidOn] = useState(todayInLagos())
  const [method, setMethod] = useState<"transfer" | "cash">("transfer")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [receipt, setReceipt] = useState<File | null>(null)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)

  // Reset the form each time the dialog opens, during render rather than in an effect.
  const [seeded, setSeeded] = useState<readonly unknown[] | null>(null)
  const seededForNext = [open, outstanding, requisition.form_type] as const
  if (depsChanged(seeded, seededForNext)) {
    setSeeded(seededForNext)
    if (open) {
      setAmount(String(outstanding))
      setPaidOn(todayInLagos())
      setMethod(requisition.form_type === "petty_cash" ? "cash" : "transfer")
      setReference("")
      setNote("")
      setReceipt(null)
      setPin("")
    }
  }

  const value = Number(amount) || 0
  const partial = value > 0 && value < outstanding

  const submit = async () => {
    if (value <= 0) return toast.error("Enter the amount paid")
    if (value > outstanding) return toast.error(`Only ${formatNaira(outstanding)} is still owed`)
    if (pin.length !== 6) return toast.error("Enter your 6-digit PIN")
    setBusy(true)
    try {
      const receiptPath = receipt ? (await uploadRequisitionFiles([receipt], "receipts"))[0].file_path : undefined
      const res = await apiFetch(`/api/requisitions/${requisition.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: value,
          paid_on: paidOn,
          method,
          reference: reference || undefined,
          note: note || undefined,
          receipt_path: receiptPath,
          pin,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not record the payment")
      toast.success(partial ? "Part payment recorded" : "Marked as paid")
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the payment")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment · {requisition.requisition_number}</DialogTitle>
          <DialogDescription>
            {formatNaira(outstanding)} still owed of {formatNaira(requisition.amount)}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount paid (₦)</Label>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {partial ? <p className="text-muted-foreground text-xs">This will be recorded as a part payment.</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Date paid</Label>
            <Input
              id="pay-date"
              type="date"
              value={paidOn}
              max={todayInLagos()}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as "transfer" | "cash")}>
              <SelectTrigger aria-label="Payment method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Reference</Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer reference"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-receipt">Receipt (optional)</Label>
            <Input
              id="pay-receipt"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pay-note">Note (optional)</Label>
            <Textarea id="pay-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            {viewer.signing_setup_missing.length ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Before you can record payments, set up your {viewer.signing_setup_missing.join(" and ")} in{" "}
                <Link href="/settings/signing" className="font-medium underline">
                  Settings → Signing
                </Link>
                .
              </p>
            ) : (
              <>
                <Label htmlFor="pay-pin">Approval PIN</Label>
                <PinInput id="pay-pin" value={pin} onChange={setPin} />
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || viewer.signing_setup_missing.length > 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
