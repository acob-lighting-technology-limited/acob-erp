"use client"

import { apiFetch } from "@/lib/api-client"
import { redact, safeContext, safePath } from "./sanitize"
import { isClientNoise } from "./noise"

export interface ClientTelemetryPayload {
  source:
    | "window.error"
    | "unhandledrejection"
    | "react.error_boundary"
    | "react.global_error_boundary"
    | "http.error"
    | "supabase.request"
    | "action.error"
  message: string
  stack?: string | null
  route?: string
  context?: Record<string, unknown>
}

const seen = new Map<string, number>()
export async function reportClientError(payload: ClientTelemetryPayload): Promise<void> {
  try {
    if (isClientNoise(payload.message, payload.stack)) return
    const route = safePath(payload.route || (typeof window !== "undefined" ? window.location.pathname : "/"))
    const fingerprint = `${payload.source}|${route}|${payload.message}`
    const now = Date.now()
    if (now - (seen.get(fingerprint) || 0) < 5000) return
    seen.set(fingerprint, now)
    if (seen.size > 200) seen.delete(seen.keys().next().value as string)
    const body = JSON.stringify({
      ...payload,
      route,
      message: redact(payload.message),
      stack: redact(payload.stack || "", 5000),
      context: safeContext(payload.context),
    })

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" })
      const sent = navigator.sendBeacon("/api/telemetry/errors", blob)
      if (sent) return
    }

    await apiFetch("/api/telemetry/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      cache: "no-store",
    })
  } catch {
    // Never throw from telemetry client helpers.
  }
}
