"use client"

import type { Dispatch, SetStateAction } from "react"
import type { LeaveBalance, LeaveType } from "../page"

import { LeaveTypesCard } from "@/components/leave/leave-types-card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface LeaveOverviewDialogProps {
  isOverviewOpen: boolean
  setIsOverviewOpen: Dispatch<SetStateAction<boolean>>
  leaveTypes: LeaveType[]
  balanceMap: Map<string, LeaveBalance>
}

export function LeaveOverviewDialog({
  isOverviewOpen,
  setIsOverviewOpen,
  leaveTypes,
  balanceMap,
}: LeaveOverviewDialogProps) {
  return (
    <Dialog open={isOverviewOpen} onOpenChange={setIsOverviewOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Leave Overview</DialogTitle>
          <DialogDescription>
            Quick guide for leave balances, request flow, and what each leave type allows.
          </DialogDescription>
        </DialogHeader>
        <LeaveTypesCard leaveTypes={leaveTypes} balanceMap={balanceMap} />
      </DialogContent>
    </Dialog>
  )
}
