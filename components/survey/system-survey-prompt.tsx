"use client"

import { useEffect, useState } from "react"
import { ClipboardList } from "lucide-react"
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
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"

const log = logger("system-survey-prompt")

export function SystemSurveyPrompt() {
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // Clear legacy snooze storage
    try {
      window.localStorage.removeItem("acob-survey-snooze-until")
    } catch {
      // ignore
    }

    let cancelled = false
    const checkSurveyStatus = async () => {
      try {
        const res = await apiFetch("/api/survey", { cache: "no-store" })
        if (!res.ok) return
        const payload = (await res.json().catch(() => null)) as { data?: unknown } | null

        if (cancelled) return

        // If user already submitted, do not prompt
        if (payload?.data) {
          return
        }

        // Show the compact centered invitation popup on reload
        setIsPromptOpen(true)
      } catch (err) {
        log.error({ err: String(err) }, "Failed to check survey status")
      }
    }

    void checkSurveyStatus()
    return () => {
      cancelled = true
    }
  }, [])

  const handleStartSurvey = () => {
    setIsPromptOpen(false)
    setIsSurveyModalOpen(true)
  }

  const handleSurveySuccess = () => {
    setIsSurveyModalOpen(false)
  }

  if (!isMounted) {
    return null
  }

  return (
    <>
      {/* Step 1: Compact Centered Invitation Dialog */}
      <Dialog open={isPromptOpen} onOpenChange={setIsPromptOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader className="gap-3 text-left">
            <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl">
              <ClipboardList className="text-primary h-6 w-6" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold">How is your ERP experience?</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                Help us evaluate system usability, speed, and features with a quick 2-minute pulse check.
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPromptOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleStartSurvey} className="h-8 text-xs">
              Start Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Full Questionnaire Modal (Only opened after clicking Start Survey) */}
      <SystemSurveyModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
        onSuccess={handleSurveySuccess}
      />
    </>
  )
}
