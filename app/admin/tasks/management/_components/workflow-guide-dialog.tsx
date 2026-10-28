"use client"

import type { Dispatch, SetStateAction } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Task } from "@/types/task"

interface WorkflowGuideDialogProps {
  isWorkflowOpen: boolean
  setIsWorkflowOpen: Dispatch<SetStateAction<boolean>>
}

export function WorkflowGuideDialog({ isWorkflowOpen, setIsWorkflowOpen }: WorkflowGuideDialogProps) {
  return (
    <Dialog open={isWorkflowOpen} onOpenChange={setIsWorkflowOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tasks & PMS Governance Guide</DialogTitle>
          <DialogDescription>
            Understanding task lifecycles, review governance, and KPI scoring impact.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2 text-xs">
          <div className="bg-muted/20 space-y-1 rounded-lg border p-3">
            <p className="text-foreground font-semibold">1. Multi-Assignment & Individual Tasks</p>
            <p className="text-muted-foreground">
              When assigning a task to multiple team members, individual task instances are generated. Each employee has
              direct, separate accountability.
            </p>
          </div>
          <div className="bg-muted/20 space-y-1 rounded-lg border p-3">
            <p className="text-foreground font-semibold">2. Corporate KPI Alignment</p>
            <p className="text-muted-foreground">
              Every task is linked to an approved departmental Corporate KPI. The associated Strategic Goal and Pillar
              are automatically aligned and feed directly into performance reviews and scorecard progress.
            </p>
          </div>
          <div className="bg-muted/20 space-y-1 rounded-lg border p-3">
            <p className="text-foreground font-semibold">3. Lead Review & Weight Scoring</p>
            <p className="text-muted-foreground">
              Submitted tasks require lead/admin approval to reach Completed status and award KPI points based on task
              weight (1–5) and review rating. Blocked tasks can be reassigned (neutral for KPI), granted extensions, or
              marked failed.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
