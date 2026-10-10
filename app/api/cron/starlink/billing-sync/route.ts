import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isGraphConfigured } from "@/lib/graph/client"
import { logger } from "@/lib/logger"
import { sendStarlinkBillingAlerts } from "@/lib/starlink/billing-alerts"
import { syncStarlinkBilling } from "@/lib/starlink/billing-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const log = logger("cron-starlink-billing-sync")

/** How far back each hourly run looks; older emails were filed by earlier runs. */
const LOOKBACK_DAYS = 45

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Files new Starlink billing emails from the ict mailbox against each kit's
 * payment (invoice PDFs, paid months, failed payments), then sends the
 * configured failed / due alerts. Called hourly by pg_cron via
 * public.call_app_endpoint.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey || !isGraphConfigured()) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const summary = await syncStarlinkBilling(supabase, { since })
    log.info(summary, "Starlink billing sync finished")
    // Alerts run on what the sync just filed; a failure here must not hide the sync result.
    let alerts: Awaited<ReturnType<typeof sendStarlinkBillingAlerts>> | { error: string }
    try {
      alerts = await sendStarlinkBillingAlerts(supabase, {
        appUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://matrix.acoblighting.com",
      })
    } catch (err) {
      alerts = { error: err instanceof Error ? err.message : String(err) }
      log.error(alerts, "Starlink billing alerts failed")
    }
    return NextResponse.json({ data: { ...summary, alerts } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err: message }, "Starlink billing sync failed")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
