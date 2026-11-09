"use client"

import type { Dispatch, SetStateAction } from "react"
import type { PayrollRow, PayrollPeriodDetail } from "../view"
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
import { Mail, Loader2, Send } from "lucide-react"

interface EmailThisPayslipDialogProps {
  emailTarget: PayrollRow | null
  emailSending: boolean
  setEmailTarget: Dispatch<SetStateAction<PayrollRow | null>>
  period: PayrollPeriodDetail
  protectPdf: boolean
  setProtectPdf: Dispatch<SetStateAction<boolean>>
  status: string
  handleEmailPayslip: () => Promise<void>
}

export function EmailThisPayslipDialog({
  emailTarget,
  emailSending,
  setEmailTarget,
  period,
  protectPdf,
  setProtectPdf,
  status,
  handleEmailPayslip,
}: EmailThisPayslipDialogProps) {
  return (
    <Dialog open={emailTarget !== null} onOpenChange={(o) => !o && !emailSending && setEmailTarget(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Email this payslip?</DialogTitle>
          <DialogDescription>
            The payslip is attached as a PDF. The email body carries no salary figures.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="bg-muted/50 space-y-1.5 rounded-md border p-3">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Recipient</span>
              <span className="font-medium break-all">{emailTarget?.company_email || "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Employee</span>
              <span className="font-medium">{emailTarget?.full_name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Period</span>
              <span className="font-medium">{period.name}</span>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={protectPdf}
              onCheckedChange={(checked) => setProtectPdf(checked === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Password-protect the PDF</span>
              <span className="text-muted-foreground block text-xs">
                The attachment opens with the employee&apos;s staff ID ({emailTarget?.employee_number || "—"}).
              </span>
            </span>
          </label>

          {status !== "completed" && (
            <p className="text-warning text-xs">
              This period is still a draft, so the payslip will be marked <strong>DRAFT</strong>. Figures are recomputed
              at send time; unsaved bonus or loan edits in the table are not included.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setEmailTarget(null)} disabled={emailSending}>
            Cancel
          </Button>
          <Button onClick={handleEmailPayslip} disabled={emailSending}>
            {emailSending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Mail className="mr-1.5 h-4 w-4" /> Send Payslip
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
