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

function isChunkLoadError(message: string): boolean {
  return (
    /loading chunk .* failed/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}

function isBenignHydrationWarning(message: string): boolean {
  return (
    message.includes("Minified React error #418") ||
    message.includes("Minified React error #423") ||
    message.includes("Minified React error #425") ||
    message.includes("Hydration failed") ||
    message.includes("Text content does not match server-rendered HTML") ||
    message.includes("There was an error while hydrating")
  )
}

function tryChunkReload(): boolean {
  if (typeof window === "undefined") return false
  try {
    const lastReload = sessionStorage.getItem("chunk_reload_monitor_ts")
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
      sessionStorage.setItem("chunk_reload_monitor_ts", now.toString())
      window.location.reload()
      return true
    }
  } catch {
    // Ignore sessionStorage errors
  }
  return false
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

      if (isChunkLoadError(message)) {
        void reportClientError({ source: "window.error", message, context: { isChunkError: true } })
        if (tryChunkReload()) {
          return
        }
      }

      if (isBenignHydrationWarning(message)) {
        void reportClientError({ source: "window.error", message })
        return
      }

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

      if (isChunkLoadError(message)) {
        void reportClientError({ source: "unhandledrejection", message, context: { isChunkError: true } })
        if (tryChunkReload()) {
          return
        }
      }

      if (isBenignHydrationWarning(message)) {
        void reportClientError({ source: "unhandledrejection", message })
        return
      }

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
