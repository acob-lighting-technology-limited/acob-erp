"use client"

import type { Dispatch, SetStateAction } from "react"
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
import { type PayrollBreakdown } from "@/lib/hr/payroll-utils"
import type { EmployeeSalaryPreset } from "../page"
import { CheckCircle2 } from "lucide-react"

interface SimulateGrossSalaryApprovalDialogProps {
  approvalDialogOpen: boolean
  setApprovalDialogOpen: Dispatch<SetStateAction<boolean>>
  selectedEmp: EmployeeSalaryPreset | null
  money: (num: number) => string
  baselineBreakdown: PayrollBreakdown
  currentBreakdown: PayrollBreakdown
  approvalNote: string
  setApprovalNote: Dispatch<SetStateAction<string>>
  handleApprove: () => void
}

export function SimulateGrossSalaryApprovalDialog({
  approvalDialogOpen,
  setApprovalDialogOpen,
  selectedEmp,
  money,
  baselineBreakdown,
  currentBreakdown,
  approvalNote,
  setApprovalNote,
  handleApprove,
}: SimulateGrossSalaryApprovalDialogProps) {
  return (
    <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Simulate Gross Salary Approval
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review and approve the altered gross salary for {selectedEmp ? selectedEmp.full_name : "this employee"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Target Employee:</span>
              <span className="font-semibold">{selectedEmp ? selectedEmp.full_name : "General Sandbox"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Original Baseline Gross:</span>
              <span className="font-mono">{money(baselineBreakdown.monthlyGross)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Approved Monthly Gross:</span>
              <span className="text-primary font-mono font-bold">{money(currentBreakdown.monthlyGross)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Approved Net Take-Home:</span>
              <span className="font-mono font-bold text-emerald-600">{money(currentBreakdown.netPay)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Approved PAYE Tax:</span>
              <span className="font-mono">{money(currentBreakdown.monthlyTax)}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="approval-note" className="text-xs font-medium">
              Approval Notes / Comments (Optional)
            </Label>
            <Input
              id="approval-note"
              placeholder="e.g. Approved gross salary increase following Q3 promotion..."
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setApprovalDialogOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleApprove}>
            Confirm & Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
