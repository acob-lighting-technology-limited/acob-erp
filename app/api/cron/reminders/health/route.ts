import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { ORG_ICT_EMAIL } from "@/lib/org-config"

const log = logger("cron-reminders-health")

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** Must match max_attempts in process_reminder_schedules(). */
const MAX_ATTEMPTS = 3
/** Grace after the final attempt before calling it failed; a full send is ~45 s. */
const CONFIRM_GRACE_MS = 15 * 60_000
/** A due schedule the scheduler has not picked up in this long means it is not running. */
const STALL_MS = 30 * 60_000
/** Older unconfirmed attempts were already handled or are no longer actionable. */
const LOOKBACK_MS = 24 * 3_600_000
/** system_settings key: { "user_ids": ["<uuid>", ...] } */
const RECIPIENTS_SETTING_KEY = "reminder_failure_alert"

type ScheduleRow = {
  id: string
  schedule_type: string
  reminder_type: string
  is_active: boolean
  next_run_at: string | null
  attempt_count: number
  last_attempt_at: string | null
  last_sent_at: string | null
  last_alerted_at: string | null
}

type Failure = {
  schedule: ScheduleRow
  kind: "unconfirmed" | "stalled"
  /** When the failure became true; an alert newer than this already covers it. */
  since: string
}

function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type Supabase = ReturnType<typeof serviceClient>

function findFailures(schedules: ScheduleRow[], now: number): Failure[] {
  const failures: Failure[] = []

  for (const schedule of schedules) {
    const lastAlerted = schedule.last_alerted_at ? Date.parse(schedule.last_alerted_at) : 0

    // All attempts made and none confirmed. mark_reminder_schedule_sent() resets
    // attempt_count to 0 on success, so a count at the cap means no email went out.
    if (schedule.attempt_count >= MAX_ATTEMPTS && schedule.last_attempt_at) {
      const lastAttempt = Date.parse(schedule.last_attempt_at)
      if (now - lastAttempt >= CONFIRM_GRACE_MS && now - lastAttempt <= LOOKBACK_MS && lastAlerted < lastAttempt) {
        failures.push({ schedule, kind: "unconfirmed", since: schedule.last_attempt_at })
        continue
      }
    }

    // Due but never picked up: pg_cron stopped, or process_reminder_schedules()
    // bailed early (e.g. the anon_key vault secret went missing).
    if (schedule.is_active && schedule.next_run_at) {
      const due = Date.parse(schedule.next_run_at)
      if (now - due >= STALL_MS && lastAlerted < due) {
        failures.push({ schedule, kind: "stalled", since: schedule.next_run_at })
      }
    }
  }

  return failures
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

  // Never fail silently for want of configuration: fall back to the ICT mailbox.
  if (emails.length === 0) emails.push(ORG_ICT_EMAIL)
  return { userIds, emails }
}

function describe(failure: Failure): string {
  const when = new Date(failure.since).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })
  const label = `${failure.schedule.schedule_type} ${failure.schedule.reminder_type} reminder`
  return failure.kind === "unconfirmed"
    ? `The ${label} was attempted ${failure.schedule.attempt_count} times (last at ${when} WAT) and no email was confirmed sent.`
    : `The ${label} was due at ${when} WAT but the scheduler has not picked it up.`
}

/**
 * Watches meeting reminder schedules and alerts IT when one fails outright.
 *
 * process_reminder_schedules() retries a send up to three times, and the edge
 * function confirms success via mark_reminder_schedule_sent(). This catches the
 * two ways that can still end with nobody notified: every attempt failing, and
 * the scheduler not running at all. Runs on Vercel, so an outage in Supabase
 * edge functions does not also take out the alert.
 */
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
    const { data, error } = await supabase
      .from("reminder_schedules")
      .select(
        "id, schedule_type, reminder_type, is_active, next_run_at, attempt_count, last_attempt_at, last_sent_at, last_alerted_at"
      )
      .returns<ScheduleRow[]>()
    if (error) throw error

    const failures = findFailures(data || [], Date.now())
    if (failures.length === 0) return NextResponse.json({ data: { alerts: 0 } })

    const { userIds, emails } = await resolveRecipients(supabase)
    const lines = failures.map(describe)
    const title =
      failures.length === 1 ? "Meeting reminder failed to send" : `${failures.length} reminders failed to send`

    let notified = 0
    for (const userId of userIds) {
      for (const failure of failures) {
        const { error: notifyError } = await supabase.rpc("create_notification", {
          p_user_id: userId,
          p_type: "reminder_send_failed",
          p_category: "system",
          p_title: title,
          p_message: describe(failure),
          p_priority: "urgent",
          p_link_url: "/admin/communications/meetings/reminders",
          p_actor_id: null,
          p_entity_type: "reminder_schedule",
          p_entity_id: failure.schedule.id,
          p_rich_content: null,
        })
        if (notifyError) log.error({ err: notifyError.message, userId }, "Alert notification failed")
        else notified++
      }
    }

    const html = `
      <p><strong>${title}</strong></p>
      <ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul>
      <p>Staff have not received it. Send it manually from
      <strong>Admin &rsaquo; Communications &rsaquo; Meeting Reminders</strong> if it is still needed.</p>
      <p style="color:#6b7280">Check the send-meeting-reminder edge function logs for the cause.</p>`
    const emailResult = await sendNotificationEmailWithRetry({ to: emails, subject: `[Action needed] ${title}`, html })
    if (!emailResult.sent) log.error({ reason: emailResult.reason }, "Alert email failed")

    // Mark as alerted only if someone was actually told, so a total delivery
    // failure is retried on the next run instead of being swallowed.
    if (emailResult.sent || notified > 0) {
      const { error: markError } = await supabase
        .from("reminder_schedules")
        .update({ last_alerted_at: new Date().toISOString() })
        .in(
          "id",
          failures.map((failure) => failure.schedule.id)
        )
      if (markError) log.error({ err: markError.message }, "Failed to record alert")
    }

    log.warn({ alerts: failures.length, emailed: emailResult.sent, notified }, "Reminder failure alert raised")
    return NextResponse.json({ data: { alerts: failures.length, emailed: emailResult.sent, notified } })
  } catch (error) {
    log.error({ err: String(error) }, "Reminder health check failed")
    return NextResponse.json({ error: "Reminder health check failed" }, { status: 500 })
  }
}
