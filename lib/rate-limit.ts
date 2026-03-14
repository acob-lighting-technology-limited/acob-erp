/**
 * In-memory sliding-window rate limiter.
 * Works in Node.js runtime (not edge). State resets on cold start.
 * Replace with Upstash Redis if multi-instance rate limiting is needed.
 */

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

// Prune expired entries every 5 minutes to avoid unbounded growth
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, win] of store) {
        if (win.resetAt < now) store.delete(key)
      }
    },
    5 * 60 * 1000
  )
}

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSec: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check and increment the rate limit counter for a given key.
 * Key should encode both the identifier (IP or user ID) and the route.
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const windowMs = opts.windowSec * 1000

  let win = store.get(key)
  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + windowMs }
    store.set(key, win)
  }

  win.count++

  return {
    allowed: win.count <= opts.limit,
    remaining: Math.max(0, opts.limit - win.count),
    resetAt: win.resetAt,
  }
}

/**
 * Extract the best available client identifier from a Request.
 * Prefers x-forwarded-for (set by Vercel), falls back to a fixed string.
 */
export function getClientId(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return "unknown"
}
