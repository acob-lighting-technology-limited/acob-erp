"use client"

import { useEffect, useRef } from "react"
import { reportClientError } from "@/lib/telemetry/client"

function normalizeMessage(value: unknown): string {
  if (typeof value === "string") return value
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return "Unknown client error"
  }
}

export function ClientErrorMonitor() {
  const seenRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const canSend = (fingerprint: string) => {
      const now = Date.now()
      const last = seenRef.current.get(fingerprint) || 0
      if (now - last < 5000) return false
      seenRef.current.set(fingerprint, now)
      if (seenRef.current.size > 200) {
        const firstKey = seenRef.current.keys().next().value
        if (firstKey) seenRef.current.delete(firstKey)
      }
      return true
    }

    const onWindowError = (event: ErrorEvent) => {
      const message = normalizeMessage(event.error || event.message || "Window error")
      const stack = event.error instanceof Error ? event.error.stack || null : null
      const route = typeof window !== "undefined" ? window.location.pathname : "/"
      const fingerprint = `${route}|window.error|${message}`
      if (!canSend(fingerprint)) return

      void reportClientError({
        source: "window.error",
        message,
        stack,
        route,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = normalizeMessage(reason)
      const stack = reason instanceof Error ? reason.stack || null : null
      const route = typeof window !== "undefined" ? window.location.pathname : "/"
      const fingerprint = `${route}|unhandledrejection|${message}`
      if (!canSend(fingerprint)) return

      void reportClientError({
        source: "unhandledrejection",
        message,
        stack,
        route,
      })
    }

    window.addEventListener("error", onWindowError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onWindowError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return null
}
