import { NextRequest, NextResponse } from "next/server"
import { hasBearerSecret } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { getServiceClient } from "@/lib/supabase/admin"
import { toLocalISODate } from "@/lib/utils/date"
import { NetworkUsageBatchSchema, planUsageUpdate, stateKeysFor, type UsageState } from "@/lib/security/network-usage"

const log = logger("ingest-network-usage")
export const dynamic = "force-dynamic"

/**
 * Receives the MikroTik's per-login data usage every 5 minutes (same bearer secret as
 * /api/ingest/network-activity). The router sends running totals; this adds only what was
 * used since the previous report to the day's row for each login and device.
 *
 * The bearer secret is checked before any work, so an unauthenticated request costs a
 * string compare. The shared rate limiter is skipped on purpose: it is a database call, and
 * this route already makes three.
 */
export async function POST(request: NextRequest) {
  if (!hasBearerSecret(request, process.env.NETWORK_ACTIVITY_INGEST_SECRET)) {
    log.warn("Invalid or missing network usage ingest token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsedJson: unknown
  try {
    parsedJson = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const result = NetworkUsageBatchSchema.safeParse(parsedJson)
  if (!result.success) {
    log.warn({ issues: result.error.issues }, "Invalid network usage payload")
    return NextResponse.json({ error: "Invalid usage payload" }, { status: 400 })
  }
  const batch = result.data

  const supabase = getServiceClient()
  if (!supabase) {
    log.error("Service role client is not configured")
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503 })
  }

  const now = new Date()

  const { data: stored, error: readError } = await supabase
    .from("network_usage_state")
    .select("key, bytes_in, bytes_out, uptime_seconds, seen_at")
    .in("key", stateKeysFor(batch))
  if (readError) {
    log.error({ err: readError.message }, "Failed to read network usage state")
    return NextResponse.json({ error: "Failed to store usage" }, { status: 502 })
  }

  const states = new Map<string, UsageState>()
  for (const row of stored ?? []) {
    states.set(row.key, {
      bytesIn: Number(row.bytes_in),
      bytesOut: Number(row.bytes_out),
      uptimeSeconds: row.uptime_seconds === null ? null : Number(row.uptime_seconds),
      seenAtMs: Date.parse(row.seen_at),
    })
  }

  const plan = planUsageUpdate(batch, states, now.getTime())
  const { error: writeError } = await supabase.rpc("apply_network_usage", {
    p_day: toLocalISODate(now),
    p_seen_at: now.toISOString(),
    p_daily: plan.daily,
    p_state: plan.wanState ? [...plan.state, plan.wanState] : plan.state,
    p_wan: plan.wan ? { router: batch.router, ...plan.wan } : null,
  })
  if (writeError) {
    log.error({ err: writeError.message }, "Failed to store network usage")
    return NextResponse.json({ error: "Failed to store usage" }, { status: 502 })
  }

  log.info({ sessions: batch.sessions.length, logins: plan.daily.length }, "Network usage stored")
  return NextResponse.json({ success: true, sessions: batch.sessions.length })
}
