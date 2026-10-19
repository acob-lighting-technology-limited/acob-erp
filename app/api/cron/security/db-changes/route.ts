import { NextRequest, NextResponse } from "next/server"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { getServiceClient } from "@/lib/supabase/admin"
import { sendPendingDbChangeAlerts } from "@/lib/security/db-change-alerts"
import { logger } from "@/lib/logger"

const log = logger("cron-security-db-changes")
export const dynamic = "force-dynamic"

/**
 * Emails database changes made outside the ERP. Called by the watch trigger the
 * moment a change is logged (throttled to once a minute), by pg_cron every 5
 * minutes as a fallback, and from the nightly reconciliation.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: "Missing configuration" }, { status: 500 })

  try {
    const result = await sendPendingDbChangeAlerts(supabase)
    return NextResponse.json({ data: result })
  } catch (error) {
    log.error({ err: String(error) }, "DB change alert run failed")
    return NextResponse.json({ error: "DB change alert run failed" }, { status: 500 })
  }
}
