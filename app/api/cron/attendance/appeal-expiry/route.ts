import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { runAppealExpiry } from "@/lib/hr/appeal-expiry"

const log = logger("cron-attendance-appeal-expiry")

/**
 * Daily at 02:00 WAT (pg_cron 'app-attendance-appeal-expiry'): pending appeals past their
 * deadline (end of the month after the appealed day) become `expired`. The first run only
 * records the start and lists the backlog for the Admin & HR Lead; nothing expires until a
 * week later. Expired is not rejected: the day stays as recorded.
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
    return NextResponse.json({ data: await runAppealExpiry(supabase) })
  } catch (err) {
    log.error({ err: String(err) }, "Attendance appeal expiry failed")
    return NextResponse.json({ error: "Attendance appeal expiry failed" }, { status: 500 })
  }
}
