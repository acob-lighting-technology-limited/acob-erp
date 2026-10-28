"use client"

import type { Dispatch, SetStateAction } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FeedbackForm } from "@/components/feedback-form"
import type { Feedback } from "../page"

interface SubmitFeedbackDialogProps {
  isSubmitOpen: boolean
  setIsSubmitOpen: Dispatch<SetStateAction<boolean>>
  handleFeedbackSubmitted: (newFeedback: Feedback) => void
}

export function SubmitFeedbackDialog({
  isSubmitOpen,
  setIsSubmitOpen,
  handleFeedbackSubmitted,
}: SubmitFeedbackDialogProps) {
  return (
    <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>Share your thoughts with management.</DialogDescription>
        </DialogHeader>
        <FeedbackForm onFeedbackSubmitted={handleFeedbackSubmitted} variant="modal" />
      </DialogContent>
    </Dialog>
  )
}
