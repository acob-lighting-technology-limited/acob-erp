"use client"

import { useState } from "react"
import { ClipboardCheck, Clock, ShieldCheck, Zap, ArrowRight } from "lucide-react"
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
      {/* Step 1: Sleek Centered Invitation Dialog */}
      <Dialog open={isPromptOpen} onOpenChange={setIsPromptOpen}>
        <DialogContent className="border-border/60 bg-card relative max-w-md overflow-hidden p-6 shadow-2xl sm:rounded-2xl">
          {/* Subtle top gradient accent line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

          <DialogHeader className="gap-3 pt-1 text-left">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-inner">
                <ClipboardCheck className="h-6 w-6 text-emerald-500" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                ACOB Matrix Pulse
              </span>
            </div>

            <div className="space-y-1.5">
              <DialogTitle className="text-foreground text-lg font-bold tracking-tight">
                How is your ERP experience?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                We recently deployed key system updates. Take 2 minutes to let us know how the system is performing for
                your daily work.
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Highlights Grid */}
          <div className="border-border/40 bg-muted/30 my-2 grid grid-cols-1 gap-2.5 rounded-xl border p-3.5 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <div className="text-foreground flex items-center gap-1 text-[11px] font-semibold">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                <span>2 Minutes</span>
              </div>
              <p className="text-muted-foreground text-[10px] leading-normal">
                Quick ratings on speed &amp; daily tools
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-foreground flex items-center gap-1 text-[11px] font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Anonymous</span>
              </div>
              <p className="text-muted-foreground text-[10px] leading-normal">Submit privately or with your name</p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-foreground flex items-center gap-1 text-[11px] font-semibold">
                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                <span>Direct Action</span>
              </div>
              <p className="text-muted-foreground text-[10px] leading-normal">Your feedback drives system fixes</p>
            </div>
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
