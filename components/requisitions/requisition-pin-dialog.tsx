"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
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
import { PinInput } from "@/components/approval-signing/pin-input"

/**
 * The confirmation step before something is signed: a small dialog that shows
 * what is about to be signed and asks for the approval PIN, the way a bank
 * asks for a PIN before it sends money. Nothing is disabled without a reason:
 * pressing Confirm with a short PIN says so.
 */
export function RequisitionPinDialog({
  open,
  onOpenChange,
  title,
  description,
  summary,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** What is being signed, as label/value rows. */
  summary: { label: string; value: ReactNode }[]
  confirmLabel: string
  /** Resolves ok when it worked (the parent closes); otherwise the error is shown here and the PIN is cleared. */
  onConfirm: (pin: string) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPin("")
      setError(null)
    }
  }, [open])

  const confirm = async () => {
    if (pin.length !== 6) {
      setError("Enter your 6-digit approval PIN.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await onConfirm(pin)
      if (!result.ok) {
        setError(result.error)
        setPin("")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <dl className="bg-muted/40 space-y-1.5 rounded-md border p-3 text-sm">
          {summary.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground shrink-0">{row.label}</dt>
              <dd className="min-w-0 text-right font-medium break-words">{row.value}</dd>
            </div>
          ))}
        </dl>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void confirm()
          }}
        >
          <Label htmlFor="confirm-pin" className="block text-center">
            Enter your approval PIN
          </Label>
          <div className="flex justify-center">
            <PinInput id="confirm-pin" value={pin} onChange={setPin} autoFocus disabled={busy} />
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-center text-sm">
              {error}
            </p>
          ) : null}
        </form>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
