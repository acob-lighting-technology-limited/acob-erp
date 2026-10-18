/** Telemetry never stores request/response bodies, headers or URL queries. */
export function safePath(value: string): string {
  try {
    return new URL(value, "https://telemetry.invalid").pathname.slice(0, 300)
  } catch {
    return "/unknown"
  }
}

export function redact(value: string, max = 1000): string {
  return value
    .replace(/Failing row contains[^\n]*/gi, "Failing row contains [redacted]")
    .replace(/\b(?:STATEMENT|DETAIL):[\s\S]*/gi, "[redacted database detail]")
    .replace(/(?:Bearer\s+)[\w.\-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[redacted token]")
    .replace(/\b(?:sb_secret_|sb_publishable_|sbp_|re_|gsk_)[\w-]+/g, "[redacted key]")
    .replace(/((?:password|token|secret|api[_-]?key|authorization)["']?\s*[=:]\s*)["']?[^\s,;}]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const parsed = new URL(url)
        return `${parsed.origin}${parsed.pathname}`
      } catch {
        return "[redacted URL]"
      }
    })
    .slice(0, max)
}

const CONTEXT_KEYS = new Set([
  "method",
  "status",
  "endpoint",
  "requestId",
  "code",
  "namespace",
  "digest",
  "shell",
  "isChunkError",
  "recovered",
  "filename",
  "lineno",
  "colno",
  "componentStack",
  "routeType",
  "platformEventId",
  "platformTimestamp",
  "service",
])

export function safeContext(context: Record<string, unknown> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (!CONTEXT_KEYS.has(key)) continue
    if (typeof value === "string") result[key] = key === "endpoint" ? safePath(value) : redact(value, 2000)
    else if (typeof value === "number" || typeof value === "boolean") result[key] = value
  }
  return result
}
