"use client"

import { useState } from "react"
import { ArrowRight, ClipboardCheck, Clock, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
        <DialogContent className="border-border/60 bg-card max-w-sm overflow-hidden p-6 shadow-2xl sm:rounded-2xl">
          {/* Subtle top gradient accent line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

          <DialogHeader className="gap-4 pt-1 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-inner">
              <ClipboardCheck className="h-6 w-6 text-emerald-500" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-foreground text-lg font-bold tracking-tight">
                How is your Matrix experience?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                Help us prioritise improvements to the tools you use every day.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="border-border/50 flex flex-col items-start gap-2 border-y py-3 text-xs">
            <span className="text-foreground flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              Takes about 2 minutes
            </span>
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              Choose whether to share your name
            </span>
          </div>

          <div className="flex flex-row items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPromptOpen(false)}
              className="text-muted-foreground hover:text-foreground h-9 px-3.5 text-xs"
            >
              Maybe Later
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleStartSurvey}
              className="h-9 gap-1.5 px-4 text-xs font-medium shadow-sm transition hover:opacity-95"
            >
              Start Survey
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
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
