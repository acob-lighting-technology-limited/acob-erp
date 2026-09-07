import { logger } from "@/lib/logger"

const log = logger("lib-audit-request-context")

/** Cap stored agents so a hostile or malformed header can't bloat the row. */
const MAX_USER_AGENT_LENGTH = 512

export interface AuditRequestContext {
  ipAddress: string | null
  userAgent: string | null
}

const EMPTY_CONTEXT: AuditRequestContext = { ipAddress: null, userAgent: null }

function firstForwardedIp(value: string | null): string | null {
  // x-forwarded-for is a comma-separated chain; the client is the first entry.
  const candidate = value?.split(",")[0]?.trim()
  return candidate ? candidate : null
}

/**
 * Reads the caller's IP and user agent from the ambient request.
 *
 * Audit writes happen in 90+ places, so this pulls from `next/headers` rather
 * than being threaded through every call site. `headers()` throws outside a
 * request scope (cron jobs, scripts, background tasks); that is expected and
 * yields a null context rather than failing the audit write.
 */
export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  try {
    const { headers } = await import("next/headers")
    const headerList = await headers()

    const ipAddress =
      firstForwardedIp(headerList.get("x-forwarded-for")) || firstForwardedIp(headerList.get("x-real-ip"))

    const rawUserAgent = headerList.get("user-agent")?.trim()
    const userAgent = rawUserAgent ? rawUserAgent.slice(0, MAX_USER_AGENT_LENGTH) : null

    return { ipAddress, userAgent }
  } catch (error) {
    log.debug({ err: error instanceof Error ? error.message : String(error) }, "no request context available")
    return EMPTY_CONTEXT
  }
}
