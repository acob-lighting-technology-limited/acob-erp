import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { sendAppealDecisionDigest } from "@/lib/hr/attendance-notify"

const log = logger("cron-attendance-appeal-digest")

/**
 * Attendance appeal decision summary.
 *
 * Every 15 minutes (pg_cron 'app-attendance-appeal-digest'). Approving a run of
 * appeals used to send one email per appeal to the employee and another to the
 * Admin & HR lead, so a lead clearing the queue flooded both inboxes (2 Nov
 * 2026: seven separate "Attendance Appeal Approved" emails in two minutes).
 * Decisions now only stamp the appeal; this sends one summary per recipient.
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
    const result = await sendAppealDecisionDigest(supabase)
    return NextResponse.json({ data: result })
  } catch (err) {
    log.error({ err: String(err) }, "Attendance appeal digest failed")
    return NextResponse.json({ error: "Attendance appeal digest failed" }, { status: 500 })
  }
}
