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
import { Receipt } from "lucide-react"
import { format, parseISO } from "date-fns"
interface PaymentWithDocs {
  documents?: {
    id: string
    document_type: string
    file_path: string
    file_name?: string
    applicable_date?: string
  }[]
}

interface ReceiptSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: PaymentWithDocs | null
  onSelectReceipt: (filePath: string) => void
}

export function ReceiptSelectionDialog({ open, onOpenChange, payment, onSelectReceipt }: ReceiptSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Receipt to Print</DialogTitle>
          <DialogDescription>Choose which receipt you want to print for this payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {payment?.documents
            ?.filter((d) => d.document_type === "receipt")
            .map((receipt, index) => (
              <Button
                key={receipt.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => onSelectReceipt(receipt.file_path)}
              >
                <Receipt className="mr-2 h-4 w-4" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{receipt.file_name || `Receipt ${index + 1}`}</span>
                  {receipt.applicable_date && (
                    <span className="text-muted-foreground text-xs">
                      Date: {format(parseISO(receipt.applicable_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </Button>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
