"use client"

import { useState } from "react"
import { Clock, MessageSquareText, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SystemSurveyModal } from "./system-survey-modal"

interface SystemSurveyPromptProps {
  hasCompletedSurvey?: boolean
}

export function SystemSurveyPrompt({ hasCompletedSurvey = false }: SystemSurveyPromptProps) {
  const [isPromptOpen, setIsPromptOpen] = useState(!hasCompletedSurvey)
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false)

  if (hasCompletedSurvey) return null

  const handleStartSurvey = () => {
    setIsPromptOpen(false)
    setIsSurveyModalOpen(true)
  }

  const handleSurveySuccess = () => {
    setIsSurveyModalOpen(false)
    setIsPromptOpen(false)
  }

  return (
    <>
      {/* Step 1: Survey invitation */}
      <Dialog open={isPromptOpen} onOpenChange={setIsPromptOpen}>
        <DialogContent className="max-w-md overflow-hidden p-0 sm:p-0">
          <DialogHeader className="flex flex-row items-start gap-3 space-y-0 p-6 pb-4 text-left">
            <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-foreground text-lg font-bold tracking-tight">
                How is your Matrix experience?
              </DialogTitle>
              <DialogDescription className="text-sm leading-5">
                Your feedback helps us prioritise improvements to the tools you use every day.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="border-y px-6 py-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <dt className="sr-only">Duration</dt>
                <dd>About 1 minute</dd>
              </div>
              <div className="text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <dt className="sr-only">Privacy</dt>
                <dd>Anonymous by default</dd>
              </div>
            </dl>
          </div>

          <DialogFooter className="bg-muted/30 flex flex-row items-center justify-end gap-2 border-t px-6 py-4 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setIsPromptOpen(false)}>
              Not now
            </Button>
            <Button type="button" onClick={handleStartSurvey}>
              Give feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Full Questionnaire Modal */}
      <SystemSurveyModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
        onSuccess={handleSurveySuccess}
      />
    </>
  )
}
