"use client"

import { useEffect, useState } from "react"
import { SystemSurveyModal } from "./system-survey-modal"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"

const log = logger("system-survey-prompt")

export function SystemSurveyPrompt() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // Clear any previous snooze key so prompt shows immediately on every reload
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

        // User hasn't submitted: immediately show centered popup modal
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

  const handleClose = () => {
    setIsModalOpen(false)
  }

  const handleSurveySuccess = () => {
    setIsModalOpen(false)
  }

  if (!isMounted) {
    return null
  }

  return <SystemSurveyModal isOpen={isModalOpen} onClose={handleClose} onSuccess={handleSurveySuccess} />
}
