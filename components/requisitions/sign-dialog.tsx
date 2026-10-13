"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PinInput } from "@/components/approval-signing/pin-input"
import { apiFetch } from "@/lib/api-client"
import { formatNaira, stageTitle } from "@/lib/requisitions/format"
import { amountChangeMessage, lineItemsTotal } from "@/lib/requisitions/limits"
import { STAGE_VERBS } from "@/lib/requisitions/routing"
import type { Requisition, RequisitionViewerActions } from "@/lib/requisitions/types"

export type SignMode = "sign" | "reject"

/**
 * Sign (optionally changing the amount) or reject the stage the viewer holds.
 * Always confirmed with the approval PIN.
 */
export function SignDialog({
  open,
  onOpenChange,
  mode,
  requisition,
  viewer,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: SignMode
  requisition: Requisition
  viewer: RequisitionViewerActions
  onDone: () => void
}) {
  const stage = requisition.stages?.find((s) => s.id === viewer.sign_stage_id)
  const bypassed = (requisition.stages || []).filter((s) => viewer.would_bypass_stage_ids.includes(s.id))
  const isPetty = requisition.form_type === "petty_cash"

  const [pin, setPin] = useState("")
  const [comments, setComments] = useState("")
  const [changeAmount, setChangeAmount] = useState(false)
  const [amount, setAmount] = useState("")
  const [lines, setLines] = useState(requisition.line_items.map((l) => String(l.amount)))
  const [splits, setSplits] = useState(requisition.beneficiary_details.map((b) => String(b.amount ?? "")))
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPin("")
    setComments("")
    setChangeAmount(false)
    setAmount(String(requisition.amount))
    setLines(requisition.line_items.map((l) => String(l.amount)))
    setSplits(requisition.beneficiary_details.map((b) => String(b.amount ?? "")))
    setReason("")
  }, [open, requisition])

  const hasSplits =
    requisition.beneficiary_details.length > 1 && requisition.beneficiary_details.some((b) => b.amount != null)
  const newTotal = useMemo(
    () => (isPetty ? lineItemsTotal(lines.map((v) => ({ amount: Number(v) || 0 }))) : Number(amount) || 0),
    [isPetty, lines, amount]
  )
  const amountProblem = changeAmount
    ? amountChangeMessage(requisition.form_type, Number(requisition.amount), newTotal)
    : null

  if (!stage) return null
  const verb = STAGE_VERBS[stage.stage_code]

  const submit = async () => {
    if (pin.length !== 6) return toast.error("Enter your 6-digit PIN")
    if (mode === "reject" && comments.trim().length < 3) return toast.error("Say why it is being rejected")
    if (changeAmount && amountProblem) return toast.error(amountProblem)
    if (changeAmount && reason.trim().length < 3) return toast.error("Say why the amount is changing")

    const body =
      mode === "reject"
        ? { action: "reject", pin, reason: comments }
        : {
            action: "sign",
            pin,
            comments: comments || undefined,
            amount_change: changeAmount
              ? {
                  reason,
                  ...(isPetty
                    ? {
                        line_items: requisition.line_items.map((l, i) => ({
                          description: l.description,
                          amount: Number(lines[i]) || 0,
                        })),
                      }
                    : { amount: newTotal }),
                  ...(hasSplits
                    ? {
                        beneficiary_details: requisition.beneficiary_details.map((b, i) => ({
                          ...b,
                          amount: Number(splits[i]) || 0,
                        })),
                      }
                    : {}),
                }
              : undefined,
          }

    setBusy(true)
    try {
      const res = await apiFetch(`/api/requisitions/${requisition.id}/act`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not complete that")
      toast.success(mode === "reject" ? "Requisition rejected" : `Signed: ${stageTitle(stage)}`)
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete that")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "reject"
              ? "Reject requisition"
              : `${verb[0].toUpperCase()}${verb.slice(1)} ${requisition.requisition_number}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "reject"
              ? "The requester will see your reason. This ends the requisition."
              : `You are signing as ${stage.role_label}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "sign" && bypassed.length ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Signing now bypasses {bypassed.map((s) => stageTitle(s)).join(", ")}.
            </p>
          ) : null}

          {mode === "sign" ? (
            <div className="space-y-3 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={changeAmount} onCheckedChange={(v) => setChangeAmount(v === true)} />
                Change the amount ({formatNaira(requisition.amount)})
              </label>
              {changeAmount ? (
                <div className="space-y-3">
                  {isPetty ? (
                    requisition.line_items.map((line, i) => (
                      <div key={i} className="grid grid-cols-[1fr_8rem] items-center gap-2">
                        <span className="truncate text-sm">{line.description}</span>
                        <Input
                          inputMode="decimal"
                          aria-label={`Amount for ${line.description}`}
                          value={lines[i]}
                          onChange={(e) => setLines((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="new-amount">New amount (₦)</Label>
                      <Input
                        id="new-amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  )}
                  {hasSplits ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">Re-split between the beneficiaries:</p>
                      {requisition.beneficiary_details.map((b, i) => (
                        <div key={i} className="grid grid-cols-[1fr_8rem] items-center gap-2">
                          <span className="truncate text-sm">{b.account_name}</span>
                          <Input
                            inputMode="decimal"
                            aria-label={`Amount for ${b.account_name}`}
                            value={splits[i]}
                            onChange={(e) => setSplits((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-sm">
                    New total: <strong>{formatNaira(newTotal)}</strong>
                  </p>
                  {amountProblem ? <p className="text-destructive text-sm">{amountProblem}</p> : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="change-reason">Reason for the change (required)</Label>
                    <Textarea id="change-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="sign-comments">{mode === "reject" ? "Reason (required)" : "Comment (optional)"}</Label>
            <Textarea id="sign-comments" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>

          {viewer.signing_setup_missing.length ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Before you can sign, set up your {viewer.signing_setup_missing.join(" and ")} in{" "}
              <Link href="/settings/signing" className="font-medium underline">
                Settings → Signing
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sign-pin">Approval PIN</Label>
              <PinInput id="sign-pin" value={pin} onChange={setPin} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={mode === "reject" ? "destructive" : "default"}
            onClick={submit}
            disabled={busy || viewer.signing_setup_missing.length > 0}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "reject" ? "Reject" : `Sign and ${verb}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
