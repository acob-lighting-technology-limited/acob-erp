"use client"

import { ArrowRightLeft, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FORM_LABELS } from "@/lib/requisitions/limits"
import type { Requisition } from "@/lib/requisitions/types"

/**
 * A rejected requisition can be fixed and sent again under its own number, or
 * converted into the other form type (a new number, linked to this one).
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
  const otherForm = requisition?.form_type === "petty_cash" ? "payment_request" : "petty_cash"
  return (
    <Dialog open={requisition !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update {requisition?.requisition_number}</DialogTitle>
          <DialogDescription>
            This was rejected{requisition?.rejection_reason ? `: ${requisition.rejection_reason}` : "."} What would you
            like to do?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="outline" className="justify-start" onClick={() => onChoose("edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit and resubmit this {FORM_LABELS[requisition?.form_type ?? "petty_cash"]}
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => onChoose("convert")}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Convert to {FORM_LABELS[otherForm]} (new number)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
