import { NextRequest, NextResponse } from "next/server"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { purgeExpiredMonths, NETWORK_LOG_RETENTION_MONTHS } from "@/lib/security/network-log-archive"

const log = logger("cron-network-log-retention")

/**
 * Daily: removes archived network-log months older than the retention window
 * from SharePoint. Scheduled by pg_cron job `app-network-log-retention`.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
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
