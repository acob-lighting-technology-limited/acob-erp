"use client"

import type { Dispatch, SetStateAction } from "react"
import type { PayrollPeriodDetail, PayrollRow } from "../view"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Send } from "lucide-react"

interface EmailAllPayslipsForDialogProps {
  bulkConfirmOpen: boolean
  bulkSending: boolean
  setBulkConfirmOpen: Dispatch<SetStateAction<boolean>>
  period: PayrollPeriodDetail
  rows: PayrollRow[]
  unsentCount: number
  protectPdf: boolean
  setProtectPdf: Dispatch<SetStateAction<boolean>>
  bulkProgress: { sent: number; failed: number; total: number }
  handleBulkSend: () => Promise<void>
}

export function EmailAllPayslipsForDialog({
  bulkConfirmOpen,
  bulkSending,
  setBulkConfirmOpen,
  period,
  rows,
  unsentCount,
  protectPdf,
  setProtectPdf,
  bulkProgress,
  handleBulkSend,
}: EmailAllPayslipsForDialogProps) {
  return (
    <Dialog open={bulkConfirmOpen} onOpenChange={(o) => !o && !bulkSending && setBulkConfirmOpen(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Email all payslips for {period.name}?</DialogTitle>
          <DialogDescription>
            Sends one email per employee, each with their own password-protectable PDF. Anyone already emailed is
            skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="bg-muted/50 space-y-1.5 rounded-md border p-3">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Already emailed</span>
              <span className="font-medium">{rows.length - unsentCount}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Will be emailed now</span>
              <span className="font-medium">{unsentCount}</span>
            </div>
          </div>

          {!bulkSending && (
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={protectPdf}
                onCheckedChange={(checked) => setProtectPdf(checked === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Password-protect each PDF</span>
                <span className="text-muted-foreground block text-xs">
                  Each attachment opens with that employee&apos;s own staff ID.
                </span>
              </span>
            </label>
          )}

          {bulkSending && (
            <div className="space-y-1.5">
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${bulkProgress.total > 0 ? ((bulkProgress.sent + bulkProgress.failed) / bulkProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Sent {bulkProgress.sent} of {bulkProgress.total}
                {bulkProgress.failed > 0 ? ` — ${bulkProgress.failed} failed` : ""}. Keep this open until it finishes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setBulkConfirmOpen(false)} disabled={bulkSending}>
            Cancel
          </Button>
          <Button onClick={handleBulkSend} disabled={bulkSending} className="bg-emerald-600 hover:bg-emerald-700">
            {bulkSending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-4 w-4" /> Send {unsentCount} Payslip{unsentCount === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
