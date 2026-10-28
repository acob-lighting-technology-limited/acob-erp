"use client"

import type { Dispatch, SetStateAction } from "react"
import { History } from "lucide-react"

import type { LeaveReviewHistoryItem } from "@/components/leave/leave-data"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatWATDateTime } from "@/lib/utils/date"

interface RecentReviewHistoryDialogProps {
  isReviewHistoryOpen: boolean
  setIsReviewHistoryOpen: Dispatch<SetStateAction<boolean>>
  pendingReviewHistory: LeaveReviewHistoryItem[]
  approvalStageLabel: (code?: string | null) => string
}

export function RecentReviewHistoryDialog({
  isReviewHistoryOpen,
  setIsReviewHistoryOpen,
  pendingReviewHistory,
  approvalStageLabel,
}: RecentReviewHistoryDialogProps) {
  return (
    <Dialog open={isReviewHistoryOpen} onOpenChange={setIsReviewHistoryOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recent Review History</DialogTitle>
          <DialogDescription>Your latest acceptance and rejection decisions are recorded here.</DialogDescription>
        </DialogHeader>
        {pendingReviewHistory.length === 0 ? (
          <p className="text-muted-foreground text-sm">No review activity yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {pendingReviewHistory.slice(0, 25).map((item) => (
              <li key={item.id} className="rounded-md border p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.status === "rejected" ? "destructive" : "outline"} className="capitalize">
                    {item.status || "recorded"}
                  </Badge>
                  <span className="font-medium">{approvalStageLabel(item.stage_code || "approval_stage")}</span>
                  <span className="text-muted-foreground">{item.request?.user?.full_name || "Employee"}</span>
                  <span className="text-muted-foreground ml-auto">
                    {item.approved_at ? formatWATDateTime(item.approved_at) : ""}
                  </span>
                </div>
                {item.comments ? <p className="mt-1">{item.comments}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
