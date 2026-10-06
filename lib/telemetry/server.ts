import { createClient } from "@supabase/supabase-js"
import { after } from "next/server"
import { headers } from "next/headers"
import { redact, safeContext, safePath } from "./sanitize"

export interface ServerFailure {
  source: string
  message: string
  stack?: string | null
  route?: string
  context?: Record<string, unknown>
  userId?: string | null
  department?: string | null
  eventId?: string
}

// Capture a transport before installing observers. Storage failures cannot recurse.
const transport = globalThis.fetch.bind(globalThis)
export function telemetryClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Telemetry storage is not configured")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: transport },
  })
}

export async function persistFailure(event: ServerFailure): Promise<string | null> {
  try {
    const id = event.eventId || crypto.randomUUID()
    const route = safePath(event.route || "/server")
    const { error } = await telemetryClient()
      .from("audit_logs")
      .upsert(
        {
          id,
          user_id: event.userId || null,
          department: event.department || null,
          operation: "error",
          table_name: "system",
          record_id: route,
          entity_id: route,
          action: "system_error",
          entity_type: "system_runtime",
          status: "error",
          error_details: redact(event.message, 1000),
          metadata: {
            source: event.source.slice(0, 100),
            route,
            stack: redact(event.stack || "", 5000),
            context: safeContext(event.context),
            resolved: false,
          },
        },
        { onConflict: "id", ignoreDuplicates: true }
      )
    if (error) throw new Error(error.message)
    return id
  } catch {
    // Intentionally use the native console: the logger itself reports errors.
    console.error("Telemetry persistence failed; check hosting logs and telemetry storage configuration")
    return null
  }
}

const seen = new Map<string, number>()
export function scheduleFailure(event: ServerFailure): void {
  const fingerprint = `${event.source}|${event.route}|${event.message}`
  const now = Date.now()
  if (now - (seen.get(fingerprint) || 0) < 5000) return
  seen.set(fingerprint, now)
  if (seen.size > 1000) seen.delete(seen.keys().next().value as string)
  const requestHeaders = headers().catch(() => null)
  const task = async () => {
    let context = event.context
    let route = event.route
    let userId = event.userId
    try {
      const h = await requestHeaders
      context = { ...context, requestId: h?.get("x-request-id") }
      route ||= h?.get("x-pathname") || undefined
      userId ||= h?.get("x-telemetry-user-id")
    } catch {
      /* Background jobs have no request scope. */
    }
    await persistFailure({ ...event, route, context, userId })
  }
  try {
    after(task)
  } catch {
    // Outside a Next request (scripts/startup), keep the original hosting log.
    console.error("Telemetry event outside request lifecycle", redact(event.message))
  }
}
