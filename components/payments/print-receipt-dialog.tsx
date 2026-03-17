"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Receipt, Printer } from "lucide-react"
import { format } from "date-fns"
import { EmptyState } from "@/components/ui/patterns"
import { logger } from "@/lib/logger"
import type { ScheduleItem, PaymentDocument } from "./payment-types"

const log = logger("print-receipt-dialog")

interface PrintReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleItem[]
  onViewDocument: (e: React.MouseEvent, doc: PaymentDocument) => Promise<void>
}

export function PrintReceiptDialog({ open, onOpenChange, schedule, onViewDocument }: PrintReceiptDialogProps) {
  const receiptItems = schedule.flatMap((item) =>
    item.documents
      .filter((d) => d.document_type === "receipt")
      .map((doc) => ({ doc, date: item.date, label: item.label }))
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Receipt to Print</DialogTitle>
          <DialogDescription>Choose a receipt from the list below to view and print.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-4">
          {receiptItems.length > 0 ? (
            receiptItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 p-2 text-green-600">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Receipt for {format(item.date, "MMM yyyy")}</p>
                    <p className="text-muted-foreground text-xs">{format(item.date, "PPP")}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async (e) => {
                    try {
                      onOpenChange(false)
                      await new Promise((resolve) => setTimeout(resolve, 100))
                      await onViewDocument(e, item.doc)
                    } catch (error) {
                      log.error("Error in print dialog:", error)
                      onOpenChange(false)
                    }
                  }}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Open
                </Button>
              </div>
            ))
          ) : (
            <EmptyState
              title="No receipts available to print"
              description="Upload a receipt and it will appear in this list."
              icon={Receipt}
              className="border-0 p-3"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
