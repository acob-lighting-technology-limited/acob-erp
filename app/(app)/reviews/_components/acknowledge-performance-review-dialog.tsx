"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Review } from "../page"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AcknowledgePerformanceReviewDialogProps {
  selectedReview: Review | null
  setSelectedReview: Dispatch<SetStateAction<Review | null>>
  employeeComments: string
  setEmployeeComments: Dispatch<SetStateAction<string>>
  acknowledgeReview: () => Promise<void>
  isSubmitting: boolean
}

export function AcknowledgePerformanceReviewDialog({
  selectedReview,
  setSelectedReview,
  employeeComments,
  setEmployeeComments,
  acknowledgeReview,
  isSubmitting,
}: AcknowledgePerformanceReviewDialogProps) {
  return (
    <Dialog open={Boolean(selectedReview)} onOpenChange={(open) => !open && setSelectedReview(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Acknowledge Performance Review</DialogTitle>
          <DialogDescription>Confirm that you have read and understood this evaluation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Any comments regarding this review?</p>
            <Textarea
              value={employeeComments}
              onChange={(e) => setEmployeeComments(e.target.value)}
              placeholder="Enter your feedback or comments here..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedReview(null)}>
            Cancel
          </Button>
          <Button onClick={acknowledgeReview} disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "I Acknowledge this Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
