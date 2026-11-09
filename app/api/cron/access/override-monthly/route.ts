import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { notifyOverridesMonthly } from "@/lib/admin/override-report"

const log = logger("cron-access-override-monthly")
export const dynamic = "force-dynamic"

/**
 * 08:00 WAT on the 1st of each month (pg_cron 'app-access-override-monthly'): tells the owners of each
 * guarded area, in-app, about the changes made there last month as an override. Sends nothing for a
 * quiet month.
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
    return NextResponse.json({ data: await notifyOverridesMonthly(supabase) })
  } catch (err) {
    log.error({ err: String(err) }, "Monthly override notice failed")
    return NextResponse.json({ error: "Monthly override notice failed" }, { status: 500 })
  }
}
