import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCpanelConfigured } from "@/lib/cpanel/client"
import { runMailboxQuotaAlerts } from "@/lib/cpanel/quota-alerts"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const log = logger("cron-mailbox-quota-alerts")

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Emails ICT and the owner when a staff mailbox reaches 90% of its quota.
 * Called daily by pg_cron via public.call_app_endpoint.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey || !isCpanelConfigured()) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const summary = await runMailboxQuotaAlerts(supabase)
    log.info({ ...summary }, "Mailbox quota alerts finished")
    return NextResponse.json({ data: summary })
  } catch (err) {
    log.error({ err: String(err) }, "Mailbox quota alerts failed")
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mailbox quota alerts failed" },
      { status: 500 }
    )
  }
}
