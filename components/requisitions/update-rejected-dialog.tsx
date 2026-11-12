"use client"

import { ArrowRightLeft, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import type { Requisition } from "@/lib/requisitions/types"

/**
 * A rejected requisition can be fixed and sent again under its own number, or
 * converted into the other form type (a new number, linked to this one). An
 * unsigned one can be edited, or switched to the other form type, which cancels it.
 */
export function UpdateRejectedDialog({
  requisition,
  onOpenChange,
  onChoose,
}: {
  requisition: Requisition | null
  onOpenChange: (open: boolean) => void
  onChoose: (choice: "edit" | "convert") => void
}) {
  const rejected = requisition?.status === "rejected"
  const otherForm = requisition?.form_type === "petty_cash" ? "payment_request" : "petty_cash"
  const ownForm = FORM_LABELS[requisition?.form_type ?? "petty_cash"]
  return (
    <Dialog open={requisition !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update {requisition?.requisition_number}</DialogTitle>
          <DialogDescription>
            {rejected
              ? `This was rejected${requisition?.rejection_reason ? `: ${requisition.rejection_reason}` : "."} What would you like to do?`
              : "Nobody has signed this yet. What would you like to do?"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="outline" className="justify-start" onClick={() => onChoose("edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            {rejected ? `Edit and resubmit this ${ownForm}` : `Edit this ${ownForm}`}
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => onChoose("convert")}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            {rejected
              ? `Convert to ${FORM_LABELS[otherForm]} (new number)`
              : `Switch to ${FORM_LABELS[otherForm]} (new number, this one is cancelled)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
