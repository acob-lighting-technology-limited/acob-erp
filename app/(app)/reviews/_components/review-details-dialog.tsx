"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Review } from "../page"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ReviewDetailsDialogProps {
  detailsReview: Review | null
  setDetailsReview: Dispatch<SetStateAction<Review | null>>
  getQuarterLabel: (review: Review) => string
  renderReviewDetails: (r: Review) => React.JSX.Element
}

export function ReviewDetailsDialog({
  detailsReview,
  setDetailsReview,
  getQuarterLabel,
  renderReviewDetails,
}: ReviewDetailsDialogProps) {
  return (
    <Dialog open={Boolean(detailsReview)} onOpenChange={(open) => !open && setDetailsReview(null)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Review Details</DialogTitle>
          <DialogDescription>{detailsReview ? getQuarterLabel(detailsReview) : "Review details"}</DialogDescription>
        </DialogHeader>
        {detailsReview ? renderReviewDetails(detailsReview) : null}
      </DialogContent>
    </Dialog>
  )
}
