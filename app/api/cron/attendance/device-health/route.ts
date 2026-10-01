import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { escapeHtml } from "@/lib/email-templates/utils"
import { ORG_EMAIL_SENDERS, ORG_ICT_EMAIL, ORG_MAIL_ROUTING } from "@/lib/org-config"
import { isWorkingDay } from "@/lib/hr/leave-days"
import { getHolidaySet } from "@/lib/hr/leave-workflow"
import { toLocalISODate } from "@/lib/utils/date"

const log = logger("cron-attendance-device-health")

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Clock-in device watchdog.
 *
 * The Hikvision unit has twice stopped delivering punches for most of a day
 * and then sent the backlog at once (Fri 18 Sep ~18:00 to Mon 21 Sep 08:17;
 * Mon 28 Sep ~16:00 to Tue 29 Sep 10:08, 2026). Nobody noticed: the overnight
 * job marked everyone incomplete, staff appealed days that were fine, and the
 * appeals sat in the queue. The ingest route cannot detect its own silence, so
 * this checks for it.
 *
 * "No punch for N hours" would fire every afternoon - punches cluster at
 * arrival and departure. So it checks the two moments punches must arrive:
 *   morning  - from 10:00 WAT, no clock-in received for today at all;
 *   evening  - from 19:00 WAT, a normal number of clock-ins but few clock-outs.
 * Each fires at most once per day; working days only.
 */
const MORNING_FROM_HOUR = 10
const EVENING_FROM_HOUR = 19
/** Below this many clock-ins the evening ratio means nothing (a quiet day, a holiday nobody entered). */
const EVENING_MIN_CLOCK_INS = 5
/** Fewer clock-outs than this share of clock-ins by 19:00 means they are not arriving. */
const EVENING_MIN_OUT_RATIO = 1 / 3
/** system_settings key holding { "<yyyy-mm-dd>:<kind>": "<alerted at>" } so each alert fires once. */
const STATE_SETTING_KEY = "attendance_device_health"
/** Same recipients as the meeting-reminder watchdog: the people who fix integrations. */
const RECIPIENTS_SETTING_KEY = "reminder_failure_alert"

type AlertKind = "morning" | "evening"

function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type Supabase = ReturnType<typeof serviceClient>

function watHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hour12: false }).format(now)
  )
}

async function countDevicePunches(supabase: Supabase, date: string, eventType: string): Promise<number> {
  const { count, error } = await supabase
    .from("attendance_events")
    .select("id", { head: true, count: "exact" })
    .eq("source", "hikvision")
    .eq("event_type", eventType)
    .eq("event_date", date)
  if (error) throw error
  return count ?? 0
}

async function resolveRecipients(supabase: Supabase): Promise<{ userIds: string[]; emails: string[] }> {
  const { data: setting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", RECIPIENTS_SETTING_KEY)
    .maybeSingle()

  const rawIds = (setting?.value as { user_ids?: unknown } | null)?.user_ids
  const userIds = Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === "string") : []

  const emails: string[] = []
  for (const userId of userIds) {
    const { data } = await supabase.auth.admin.getUserById(userId)
    if (data?.user?.email) emails.push(data.user.email)
  }
  // The device being down is ICT's to fix, so the ICT mailbox always hears about it.
  emails.push(ORG_ICT_EMAIL)
  return { userIds, emails: Array.from(new Set(emails.map((email) => email.toLowerCase()))) }
}

function renderAlertHtml(title: string, lines: string[]): string {
  const darkLock =
    "background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;"
  const bar = (content: string, padding: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="${darkLock}border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;"><tr><td align="center" style="padding:${padding};${darkLock}font-size:11px;color:#d1d5db;">${content}</td></tr></table>`
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#fff;font-family:Segoe UI, Tahoma, Geneva, Verdana, sans-serif;">' +
    '<div style="max-width:600px;margin:0 auto;">' +
    bar(
      '<img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" height="60" alt="ACOB Lighting">',
      "20px 0"
    ) +
    '<div style="padding:32px 28px;">' +
    `<div style="font-size:20px;font-weight:700;color:#991b1b;margin:0 0 12px;">${escapeHtml(title)}</div>` +
    `<ul style="font-size:14px;color:#374151;line-height:1.6;padding-left:18px;">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` +
    '<p style="font-size:14px;color:#374151;line-height:1.6;">Check the Hikvision terminal is powered, on the network, and can reach the app. When it reconnects it sends its backlog and attendance corrects itself; appeals raised meanwhile close automatically once the day is fine.</p>' +
    "</div>" +
    bar(
      '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br><span style="color:#16a34a;font-weight:600;">IT &amp; Communications</span><br><br><i style="color:#9ca3af;">This is an automated notification.</i>',
      "20px"
    ) +
    "</div></body></html>"
  )
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  }
  const supabase = serviceClient(supabaseUrl, supabaseServiceKey)

  try {
    const now = new Date()
    const today = toLocalISODate(now)
    const hour = watHour(now)

    const holidays = await getHolidaySet(supabase, null, today, today)
    if (!isWorkingDay(today, holidays)) return NextResponse.json({ data: { skipped: "not_a_working_day" } })
    if (hour < MORNING_FROM_HOUR) return NextResponse.json({ data: { skipped: "too_early" } })

    const [clockIns, clockOuts] = await Promise.all([
      countDevicePunches(supabase, today, "device_punch_in"),
      countDevicePunches(supabase, today, "device_punch_out"),
    ])

    let kind: AlertKind | null = null
    let detail = ""
    if (clockIns === 0) {
      kind = "morning"
      detail = `It is past ${MORNING_FROM_HOUR}:00 WAT on a working day and no clock-ins have been received from the device today.`
    } else if (
      hour >= EVENING_FROM_HOUR &&
      clockIns >= EVENING_MIN_CLOCK_INS &&
      clockOuts < clockIns * EVENING_MIN_OUT_RATIO
    ) {
      kind = "evening"
      detail = `By ${EVENING_FROM_HOUR}:00 WAT the device has sent ${clockIns} clock-ins but only ${clockOuts} clock-outs today.`
    }

    if (!kind) return NextResponse.json({ data: { healthy: true, clockIns, clockOuts } })

    const { data: stateRow } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", STATE_SETTING_KEY)
      .maybeSingle()
    const state = ((stateRow?.value as Record<string, string> | null) ?? {}) as Record<string, string>
    const stateKey = `${today}:${kind}`
    if (state[stateKey]) return NextResponse.json({ data: { alreadyAlerted: stateKey } })

    const title = "Clock-in device has stopped sending punches"
    const lines = [
      detail,
      "Until it reconnects, staff will look absent or incomplete, and the overnight job will mark missing clock-outs as incomplete.",
    ]
    const { userIds, emails } = await resolveRecipients(supabase)

    let notified = 0
    for (const userId of userIds) {
      const { error } = await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: "system",
        p_category: "system",
        p_title: title,
        p_message: lines.join(" "),
        p_priority: "urgent",
        p_link_url: "/admin/hr/attendance",
        p_actor_id: null,
        p_entity_type: "attendance_device_health",
        p_entity_id: null,
        p_rich_content: null,
      })
      if (error) log.error({ err: error.message, userId }, "Device alert notification failed")
      else notified++
    }

    // Ungated, like the reminder watchdog: an infrastructure alarm for the
    // people who fix it, not a staff notification stream.
    const html = renderAlertHtml(title, lines)
    let emailed = 0
    for (const email of emails) {
      const result = await sendNotificationEmailWithRetry({
        from: ORG_EMAIL_SENDERS.system,
        ...ORG_MAIL_ROUTING["System Health"],
        to: [email],
        subject: `Clock-in Device Offline — ${today}`,
        html,
      })
      if (result.sent) emailed++
      else log.error({ reason: result.reason }, "Device alert email failed")
    }

    // Recorded only when someone was told, so a total delivery failure retries next run.
    if (emailed > 0 || notified > 0) {
      // Keep a week of history; older keys are dropped as the map is rewritten.
      const cutoff = toLocalISODate(new Date(now.getTime() - 7 * 86_400_000))
      const kept = Object.fromEntries(Object.entries(state).filter(([key]) => key.slice(0, 10) >= cutoff))
      const { error: saveError } = await supabase
        .from("system_settings")
        .upsert({ key: STATE_SETTING_KEY, value: { ...kept, [stateKey]: now.toISOString() } }, { onConflict: "key" })
      if (saveError) log.error({ err: saveError.message }, "Failed to record device alert")
    }

    log.warn({ kind, clockIns, clockOuts, emailed, notified }, "Clock-in device alert raised")
    return NextResponse.json({ data: { alert: kind, clockIns, clockOuts, emailed, notified } })
  } catch (error) {
    log.error({ err: String(error) }, "Device health check failed")
    return NextResponse.json({ error: "Device health check failed" }, { status: 500 })
  }
}
