"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"

interface PaymentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploadDate: Date | null
  uploadType: "invoice" | "receipt"
  uploading: boolean
  replaceDocumentId: string | null
  onSubmit: (e: React.FormEvent, fileInputRef: React.RefObject<HTMLInputElement | null>) => void
}

export function PaymentUploadDialog({
  open,
  onOpenChange,
  uploadDate,
  uploadType,
  uploading,
  replaceDocumentId,
  onSubmit,
}: PaymentUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOpenChange = (value: boolean) => {
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {replaceDocumentId ? "Replace" : "Upload"} {uploadType === "invoice" ? "Invoice" : "Receipt"}
          </DialogTitle>
          <DialogDescription>
            {replaceDocumentId
              ? `Replace the existing ${uploadType} for the payment period of ${uploadDate ? format(uploadDate, "PPP") : ""}. The old document will be archived.`
              : `Upload a document for the payment period of ${uploadDate ? format(uploadDate, "PPP") : ""}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => onSubmit(e, fileInputRef)}>
          <div className="grid w-full items-center gap-4 py-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="file">Document File</Label>
              <Input id="file" type="file" ref={fileInputRef} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading
                ? replaceDocumentId
                  ? "Replacing..."
                  : "Uploading..."
                : replaceDocumentId
                  ? "Replace"
                  : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
