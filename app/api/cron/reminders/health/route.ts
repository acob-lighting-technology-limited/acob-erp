import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { escapeHtml } from "@/lib/email-templates/utils"
import { ORG_EMAIL_SENDERS, ORG_ICT_EMAIL, ORG_MAIL_ROUTING } from "@/lib/org-config"
import { taskDeadline } from "@/lib/tasks/overdue"
import { toLocalISODate } from "@/lib/utils/date"

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

/**
 * Task expiry watchdog.
 *
 * The KPI calculation stopped presuming unfinished work had failed once the
 * nightly expiry job became reliable: unfinished tasks are held out of the
 * score and enter it when that job marks them `failed`. The failure mode is
 * therefore silent and upward - if the job stops, nothing is ever failed, and
 * everyone's KPI drifts up with nobody noticing. The expiry job cannot detect
 * its own absence, so this one does, by checking the invariant rather than the
 * plumbing: work this far past its deadline and still open should not exist.
 *
 * The count threshold keeps a single long absence from tripping it - someone
 * on a month's leave legitimately keeps a few tasks open - while a stopped job
 * builds a backlog well past it within days.
 */
const EXPIRY_STALE_DAYS = 14
const EXPIRY_STALE_THRESHOLD = 10

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

/** Branded ACOB shell (dark-mode-locked header/footer), per the email template standard. */
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
    '<p style="font-size:14px;color:#374151;line-height:1.6;">Staff have not received it. Send it manually from <strong>Admin &rsaquo; Communications &rsaquo; Meeting Reminders</strong> if it is still needed.</p>' +
    '<p style="font-size:13px;color:#6b7280;">Check the send-meeting-reminder edge function logs for the cause.</p>' +
    "</div>" +
    bar(
      '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br><span style="color:#16a34a;font-weight:600;">IT &amp; Communications</span><br><br><i style="color:#9ca3af;">This is an automated notification.</i>',
      "20px"
    ) +
    "</div></body></html>"
  )
}

/**
 * Open work so far past its deadline that the expiry job cannot be running.
 *
 * The deadline is `task_end_date` where set and `due_date` otherwise, which no
 * single column filter expresses - a plan task can carry an early due_date and
 * a much later end date, and counting it by due_date alone would raise a false
 * alarm. So both columns come back and `taskDeadline` decides.
 */
async function countUnexpiredOverdue(supabase: Supabase): Promise<number> {
  const cutoff = toLocalISODate(new Date(Date.now() - EXPIRY_STALE_DAYS * 86_400_000))
  const { data, error } = await supabase
    .from("tasks")
    .select("id, due_date, task_end_date")
    .in("status", ["pending", "in_progress", "unable_to_complete"])
    .eq("is_archived", false)
    .or(`due_date.lt.${cutoff},task_end_date.lt.${cutoff}`)
    .returns<Array<{ due_date: string | null; task_end_date: string | null }>>()

  if (error) {
    log.error({ err: error.message }, "Expiry watchdog lookup failed")
    return 0
  }
  return (data ?? []).filter((task) => {
    const deadline = taskDeadline(task)
    return deadline !== null && deadline < cutoff
  }).length
}

/** Alerts the configured recipients, once a day, that expiry has stalled. */
async function alertStaleExpiry(supabase: Supabase, staleCount: number): Promise<void> {
  const { userIds } = await resolveRecipients(supabase)
  for (const userId of userIds) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .eq("type", "system")
      .eq("entity_type", "cron_task_expiry")
      .gte("created_at", new Date(Date.now() - 24 * 3_600_000).toISOString())
    if (count && count > 0) continue

    const { error } = await supabase.rpc("create_notification", {
      p_user_id: userId,
      p_type: "system",
      p_category: "system",
      p_title: "Task expiry job has stopped",
      p_message:
        `${staleCount} tasks are more than ${EXPIRY_STALE_DAYS} days past their deadline and still open. ` +
        "The nightly expiry job is not failing them, so unfinished work is missing from everyone's KPI. " +
        "Check the app-tasks-expire-overdue pg_cron job.",
      p_priority: "urgent",
      p_link_url: "/admin/tasks",
      p_actor_id: null,
      p_entity_type: "cron_task_expiry",
      p_entity_id: null,
      p_rich_content: null,
    })
    if (error) log.error({ err: error.message, userId }, "Expiry watchdog alert failed")
  }
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
    const staleExpiry = await countUnexpiredOverdue(supabase)

    if (staleExpiry > EXPIRY_STALE_THRESHOLD) {
      log.error({ staleExpiry }, "Task expiry job appears to have stopped: overdue work is not being failed")
      await alertStaleExpiry(supabase, staleExpiry)
    }

    if (failures.length === 0) return NextResponse.json({ data: { alerts: 0, staleExpiry } })

    const { userIds, emails } = await resolveRecipients(supabase)
    const lines = failures.map(describe)
    const title =
      failures.length === 1 ? "Meeting reminder failed to send" : `${failures.length} reminders failed to send`

    let notified = 0
    for (const userId of userIds) {
      for (const failure of failures) {
        const { error: notifyError } = await supabase.rpc("create_notification", {
          p_user_id: userId,
          p_type: "system",
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

    const html = renderAlertHtml(title, lines)
    const subject = `Meeting Reminder Failed to Send — ${new Date(failures[0].since).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" })}`
    // Deliberately ungated: this is the alarm that fires when the mail system
    // itself is failing, sent to the developers who fix it, not a notification
    // stream staff receive. Gating it behind Mail Settings would let one bad
    // toggle silence the warning that the toggles are broken.
    // One email per recipient, so nobody sees the others' addresses.
    let emailed = 0
    for (const email of emails) {
      const result = await sendNotificationEmailWithRetry({
        from: ORG_EMAIL_SENDERS.system,
        ...ORG_MAIL_ROUTING["System Health"],
        to: [email],
        subject,
        html,
      })
      if (result.sent) emailed++
      else log.error({ reason: result.reason }, "Alert email failed")
    }

    // Mark as alerted only if someone was actually told, so a total delivery
    // failure is retried on the next run instead of being swallowed.
    if (emailed > 0 || notified > 0) {
      const { error: markError } = await supabase
        .from("reminder_schedules")
        .update({ last_alerted_at: new Date().toISOString() })
        .in(
          "id",
          failures.map((failure) => failure.schedule.id)
        )
      if (markError) log.error({ err: markError.message }, "Failed to record alert")
    }

    log.warn({ alerts: failures.length, emailed, notified }, "Reminder failure alert raised")
    return NextResponse.json({ data: { alerts: failures.length, emailed, notified } })
  } catch (error) {
    log.error({ err: String(error) }, "Reminder health check failed")
    return NextResponse.json({ error: "Reminder health check failed" }, { status: 500 })
  }
}
