"use client"

import { useEffect, useState } from "react"
import { SystemSurveyModal } from "./system-survey-modal"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"

const log = logger("system-survey-prompt")

const SNOOZE_KEY = "acob-survey-snooze-until"
const SUBMITTED_KEY = "acob-survey-submitted"
const SNOOZE_MS = 3 * 60 * 60 * 1000 // 3 hours in milliseconds

export function SystemSurveyPrompt() {
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

        // User hasn't completed and is not snoozed — popup centered modal
        setIsModalOpen(true)
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
    setIsModalOpen(false)
    try {
      const nextTime = Date.now() + SNOOZE_MS
      window.localStorage.setItem(SNOOZE_KEY, String(nextTime))
    } catch {
      // ignore
    }
  }

  const handleSurveySuccess = () => {
    setIsModalOpen(false)
    try {
      window.localStorage.setItem(SUBMITTED_KEY, "true")
    } catch {
      // ignore
    }
  }

  if (!isMounted) {
    return null
  }

  return (
    <SystemSurveyModal
      isOpen={isModalOpen}
      onClose={handleSnooze}
      onSnooze={handleSnooze}
      onSuccess={handleSurveySuccess}
    />
  )
}
