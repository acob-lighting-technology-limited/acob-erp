import { timingSafeEqual } from "crypto"

/** Constant-time string comparison (length mismatch returns early, which leaks only length). */
export function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/** The bearer token from an `Authorization: Bearer <token>` header, or null. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/**
 * True when the request carries `Authorization: Bearer <secret>` and `secret` is
 * configured. Secrets are only ever accepted from the header — never a query
 * string, which ends up in access logs.
 */
export function hasBearerSecret(request: Request, secret: string | undefined): boolean {
  if (!secret) return false
  const token = readBearerToken(request)
  return token !== null && safeCompare(token, secret)
}

/** Shorthand for scheduled jobs: `if (!isCronRequest(request)) return 401`. */
export function isCronRequest(request: Request): boolean {
  return hasBearerSecret(request, process.env.CRON_SECRET)
}
