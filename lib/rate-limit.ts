import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()
const limiterCache = new Map<string, Ratelimit>()
const hasRedisConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL)
const redis = hasRedisConfig ? Redis.fromEnv() : null
let hasWarnedAboutMemoryFallback = false

// Prune expired entries every 5 minutes to avoid unbounded growth
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, win] of Array.from(store)) {
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

export function createRateLimiter(opts: { limit: number; windowSec: number }) {
  if (!redis) {
    throw new Error("Upstash Redis is not configured")
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowSec} s`),
  })
}

function getMemoryRateLimitResult(key: string, opts: RateLimitOptions): RateLimitResult {
  if (!hasWarnedAboutMemoryFallback) {
    console.warn("Rate limiting falling back to in-memory — not suitable for production")
    hasWarnedAboutMemoryFallback = true
  }

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
 * Check and increment the rate limit counter for a given key.
 * Key should encode both the identifier (IP or user ID) and the route.
 */
export async function rateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  if (!redis) {
    return getMemoryRateLimitResult(key, opts)
  }

  const cacheKey = `${opts.limit}:${opts.windowSec}`
  let limiter = limiterCache.get(cacheKey)
  if (!limiter) {
    limiter = createRateLimiter(opts)
    limiterCache.set(cacheKey, limiter)
  }

  const result = await limiter.limit(key)

  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
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
