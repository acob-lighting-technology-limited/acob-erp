"use client"

import { useEffect, useState } from "react"
import { Star, X, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SystemSurveyModal } from "./system-survey-modal"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"

const log = logger("system-survey-prompt")

const SNOOZE_KEY = "acob-survey-snooze-until"
const SUBMITTED_KEY = "acob-survey-submitted"
const SNOOZE_MS = 3 * 60 * 60 * 1000 // 3 hours in milliseconds

export function SystemSurveyPrompt() {
  const [isOpen, setIsOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // Check localStorage first
    try {
      const isSubmitted = window.localStorage.getItem(SUBMITTED_KEY) === "true"
      if (isSubmitted) return

      const snoozeUntil = Number(window.localStorage.getItem(SNOOZE_KEY) || 0)
      if (Date.now() < snoozeUntil) return
    } catch {
      // ignore storage error
    }

    // Check with server if user already submitted a survey
    let cancelled = false
    const checkSurveyStatus = async () => {
      try {
        const res = await apiFetch("/api/survey", { cache: "no-store" })
        if (!res.ok) return
        const payload = (await res.json().catch(() => null)) as { data?: unknown } | null

        if (cancelled) return

        if (payload?.data) {
          // User already completed the survey
          try {
            window.localStorage.setItem(SUBMITTED_KEY, "true")
          } catch {
            // ignore
          }
          return
        }

        // User hasn't completed and is not snoozed — display prompt
        setIsOpen(true)
      } catch (err) {
        log.error({ err: String(err) }, "Failed to verify survey status")
      }
    }

    void checkSurveyStatus()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSnooze = () => {
    setIsOpen(false)
    try {
      const nextTime = Date.now() + SNOOZE_MS
      window.localStorage.setItem(SNOOZE_KEY, String(nextTime))
    } catch {
      // ignore
    }
  }

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleSurveySuccess = () => {
    setIsOpen(false)
    try {
      window.localStorage.setItem(SUBMITTED_KEY, "true")
    } catch {
      // ignore
    }
  }

  if (!isMounted || !isOpen) {
    return (
      <SystemSurveyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSurveySuccess} />
    )
  }

  return (
    <>
      <div
        role="complementary"
        aria-label="System Satisfaction Survey Prompt"
        className="border-primary/20 bg-background/95 animate-in fade-in slide-in-from-bottom-5 fixed right-6 bottom-6 z-50 max-w-sm rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300"
      >
        <button
          type="button"
          onClick={handleSnooze}
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 rounded-md p-1 transition"
          aria-label="Snooze for 3 hours"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
          </div>

          <div className="space-y-1 pr-4">
            <h4 className="text-foreground text-sm font-semibold">How is your ERP experience?</h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Help us evaluate the new system with a quick 2-minute pulse check.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSnooze}
            className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
          >
            <Clock className="mr-1 h-3.5 w-3.5" />
            Remind in 3 hrs
          </Button>

          <Button type="button" size="sm" onClick={handleOpenModal} className="h-8 text-xs">
            Take Survey
          </Button>
        </div>
      </div>

      <SystemSurveyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSurveySuccess} />
    </>
  )
}
