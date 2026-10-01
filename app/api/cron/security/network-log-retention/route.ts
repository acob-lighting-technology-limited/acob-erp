import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { purgeExpiredMonths, NETWORK_LOG_RETENTION_MONTHS } from "@/lib/security/network-log-archive"

const log = logger("cron-network-log-retention")

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Daily: removes archived network-log months older than the retention window
 * from SharePoint. Scheduled by pg_cron job `app-network-log-retention`.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const removed = await purgeExpiredMonths()
    if (removed.length > 0) log.info({ removed }, "Purged expired network log months")
    return NextResponse.json({ success: true, retentionMonths: NETWORK_LOG_RETENTION_MONTHS, removed })
  } catch (error) {
    log.error({ err: String(error) }, "Network log retention failed")
    return NextResponse.json({ error: "Retention run failed" }, { status: 502 })
  }
}
