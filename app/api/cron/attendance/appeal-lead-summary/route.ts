import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { sendAppealLeadDailySummary } from "@/lib/hr/attendance-notify"

const log = logger("cron-attendance-appeal-lead-summary")

/**
 * Daily attendance appeal summary for leads.
 *
 * 08:30 WAT every day (pg_cron 'app-attendance-appeal-lead-summary'), with a
 * 08:50 rerun in case the first call failed; the summary records the day it
 * went out, so the rerun sends nothing after a success. Leads get no other
 * appeal email: this replaces one email per submitted appeal and a copy of
 * every decision.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const result = await sendAppealLeadDailySummary(supabase)
    return NextResponse.json({ data: result })
  } catch (err) {
    log.error({ err: String(err) }, "Attendance appeal lead summary failed")
    return NextResponse.json({ error: "Attendance appeal lead summary failed" }, { status: 500 })
  }
}
