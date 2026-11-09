import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { notifySelfApprovedMonthly } from "@/lib/hr/self-approved"

const log = logger("cron-attendance-self-approved-monthly")

/**
 * 07:30 WAT on the 1st of each month (pg_cron 'app-attendance-self-approved-monthly'):
 * tells the MD's Desk, in-app only, how many attendance appeals were approved by the
 * person they are about last month, with a link to the list. Sends nothing for an empty month.
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
    return NextResponse.json({ data: await notifySelfApprovedMonthly(supabase) })
  } catch (err) {
    log.error({ err: String(err) }, "Self-approved appeals notice failed")
    return NextResponse.json({ error: "Self-approved appeals notice failed" }, { status: 500 })
  }
}
