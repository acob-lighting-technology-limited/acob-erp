import { safePath } from "./sanitize"

export interface RequestFailure {
  source: "http.error" | "supabase.request"
  message: string
  context: Record<string, unknown>
}

// Statuses that are routine outcomes, not defects: an expired session (401), a
// missing record (404), `.single()` matching no row (406), a rate limit (429).
const ROUTINE_STATUSES = new Set([401, 404, 406, 429])
// Supabase conflicts are mostly handled duplicate inserts ("already voted").
const ROUTINE_SUPABASE_STATUSES = new Set([409])

/**
 * Whether a failed response is worth a developer's attention. Server errors and
 * unreachable servers always are; client errors only when they are not routine.
 * Supabase Auth 4xx are wrong passwords and stale refresh tokens, so skipped.
 */
export function isReportableFailure(status: number, path: string, isSupabase: boolean): boolean {
  if (status === 0 || status >= 500) return true
  if (status < 400 || ROUTINE_STATUSES.has(status)) return false
  if (isSupabase) return !ROUTINE_SUPABASE_STATUSES.has(status) && !path.startsWith("/auth/v1/")
  return true
}

/** Leaves response streams and thrown errors unchanged; ignores intentional aborts. */
export function monitoredFetch(
  original: typeof fetch,
  origin: string,
  supabaseUrl: string | undefined,
  report: (failure: RequestFailure) => void
): typeof fetch {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null
  return async (input, init) => {
    const rawUrl = input instanceof Request ? input.url : String(input)
    const url = new URL(rawUrl, origin)
    const isSupabase = url.origin === supabaseOrigin
    const monitored =
      (isSupabase || (url.origin === origin && url.pathname.startsWith("/api/"))) &&
      !url.pathname.startsWith("/api/telemetry/") &&
      !url.pathname.startsWith("/api/cron/collect-errors") &&
      !url.pathname.startsWith("/rest/v1/audit_logs") &&
      url.pathname !== "/rest/v1/rpc/log_audit"
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
    const endpoint = safePath(url.pathname)
    const emit = (status: number, requestId?: string | null) => {
      if (!monitored || !isReportableFailure(status, url.pathname, isSupabase)) return
      try {
        report({
          source: isSupabase ? "supabase.request" : "http.error",
          message: `${method} ${endpoint} ${status ? `failed (${status})` : "could not reach the server"}`,
          context: { method, endpoint, status, requestId },
        })
      } catch {
        // Reporting must never change a business operation's outcome.
      }
    }
    try {
      const response = await original(input, init)
      if (!response.ok) emit(response.status, response.headers.get("x-request-id"))
      return response
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) emit(0)
      throw error
    }
  }
}
