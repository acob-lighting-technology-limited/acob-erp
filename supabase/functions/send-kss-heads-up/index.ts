// Monday heads-up for the Knowledge Sharing Session (KSS).
//
// Called by public.process_kss_heads_up() (pg_cron, Mondays after the configured
// time) with the office week of NEXT Monday's meeting. Emails everyone active in
// that week's department plus the Admin and HR lead, the HCS (Corporate Services
// lead) and the MD (Executive Management lead), one email per person, each with a
// matching in-app notification. Confirms delivery via mark_kss_heads_up_sent().

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { sendEmail } from "../_shared/email.ts"
import { EDGE_MAIL_ROUTING, EDGE_SENDERS } from "../_shared/senders.ts"
import { isEdgeSystemEmailEnabled } from "../_shared/notification-gateway.ts"
import { resolveEffectiveMeetingDateIso, formatMeetingDateLabel } from "../_shared/meeting-date.ts"
import { isSameDepartment } from "../../../shared/departments.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

/** Leadership copied on every heads-up, matched the same way leave approvals resolve them. */
const LEADERSHIP_DEPARTMENTS = ["Admin and HR", "Corporate Services", "Executive Management"]
/** The scheduler logs an attempt immediately before calling; anything older is not a scheduled call. */
const ATTEMPT_WINDOW_MS = 15 * 60_000

type ProfileRow = {
  id: string
  full_name: string | null
  department: string | null
  company_email: string | null
  additional_email: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
}

type Recipient = { userId: string; email: string; name: string }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function leadsDepartment(profile: ProfileRow, department: string): boolean {
  if (!profile.is_department_lead) return false
  if (isSameDepartment(profile.department, department)) return true
  return (profile.lead_departments || []).some((managed) => isSameDepartment(managed, department))
}

function buildHtml(params: { department: string; meetingDateLabel: string; recipientName: string }): string {
  const department = escapeHtml(params.department)
  const dateLabel = escapeHtml(params.meetingDateLabel)
  const name = escapeHtml(params.recipientName || "Colleague")
  const darkLock =
    "background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;"

  return (
    "<!DOCTYPE html>" +
    '<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "</head><body style=\"margin:0;padding:0;background:#fff;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\">" +
    '<div style="background:#f3f4f6;padding:24px 0;">' +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="${darkLock}border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;">` +
    `<tr><td align="center" style="padding:20px 0;${darkLock}">` +
    '<img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" height="60" alt="ACOB Lighting">' +
    "</td></tr></table>" +
    '<div style="max-width:600px;margin:0 auto;background:#fff;padding:32px 28px;">' +
    '<div style="font-size:20px;font-weight:700;color:#111827;margin:0 0 6px;">Knowledge Sharing Session Next Week</div>' +
    `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">Dear ${name},</p>` +
    `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">The <strong>${department}</strong> department is scheduled to present the Knowledge Sharing Session at the General Weekly Meeting on <strong>${dateLabel}</strong>.</p>` +
    '<div style="margin:22px 0;border:1px solid #d1d5db;overflow:hidden;background:#f9fafb;border-radius:8px;">' +
    '<div style="padding:12px 18px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #d1d5db;background:#ecfdf5;color:#065f46;">What to do</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '<tr><td style="padding:10px 18px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">Agree who in the department will present.</td></tr>' +
    '<tr><td style="padding:10px 18px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">Prepare the presentation before the meeting.</td></tr>' +
    '<tr><td style="padding:10px 18px;font-size:14px;color:#374151;">Let Admin &amp; HR know the presenter so they can be added to the roster.</td></tr>' +
    "</table></div>" +
    '<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">You are receiving this because you are in the presenting department or on the leadership team.</p>' +
    "</div>" +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="${darkLock}border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;">` +
    `<tr><td align="center" style="padding:20px;${darkLock}font-size:11px;color:#d1d5db;">` +
    '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>' +
    '<span style="color:#16a34a;font-weight:600;">Admin &amp; HR Department</span><br><br>' +
    '<i style="color:#9ca3af;">This is an automated notification, but replies are read — reply to this email and it reaches the team that sent it.</i>' +
    "</td></tr></table>" +
    "</div></body></html>"
  )
}

serve(async (req) => {
  if (!req.headers.get("Authorization")) return new Response("Unauthorized", { status: 401 })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = (await req.json().catch(() => ({}))) as {
      meetingWeek?: number
      meetingYear?: number
      previewTo?: string
    }
    const week = Number(body.meetingWeek)
    const year = Number(body.meetingYear)
    if (!Number.isInteger(week) || !Number.isInteger(year))
      return json({ error: "meetingWeek and meetingYear required" }, 400)

    // Preview: one email to a single address, no notifications, nothing marked sent.
    // Service-role callers only, so the public anon key cannot use it as a relay.
    const previewTo = typeof body.previewTo === "string" ? body.previewTo.trim() : ""
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearers+/i, "").trim()
    if (previewTo && (!SUPABASE_SERVICE_ROLE_KEY || bearer !== SUPABASE_SERVICE_ROLE_KEY)) {
      return json({ error: "Preview requires the service role" }, 403)
    }

    // Only act on a send the scheduler has just logged: stops anyone holding the
    // public anon key from mailing a department on demand or re-sending.
    const { data: log, error: logError } = await supabase
      .from("kss_heads_up_log")
      .select("department, sent_at, last_attempt_at")
      .eq("meeting_week", week)
      .eq("meeting_year", year)
      .maybeSingle()
    if (logError) throw new Error(`heads-up log query failed: ${logError.message}`)
    const lastAttempt = log?.last_attempt_at ? Date.parse(log.last_attempt_at) : 0
    if (!previewTo && (!log || log.sent_at || Date.now() - lastAttempt > ATTEMPT_WINDOW_MS)) {
      return json({ skipped: true, reason: "no_pending_scheduled_attempt" })
    }

    if (!(await isEdgeSystemEmailEnabled(supabase, "meetings"))) {
      return json({ skipped: true, reason: "meetings_email_disabled" })
    }

    const { data: resolved, error: resolveError } = await supabase.rpc("kss_department_for_week", {
      p_week: week,
      p_year: year,
    })
    if (resolveError) throw new Error(`department lookup failed: ${resolveError.message}`)
    const department = String((resolved as Array<{ department: string | null }> | null)?.[0]?.department || "").trim()
    if (!department) return json({ skipped: true, reason: "no_department" })

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, department, company_email, additional_email, is_department_lead, lead_departments")
      .eq("employment_status", "active")
    if (profilesError) throw new Error(`profiles query failed: ${profilesError.message}`)
    const active = (profiles || []) as ProfileRow[]
    if (active.length === 0) throw new Error("No active profiles returned")

    const recipients = new Map<string, Recipient>()
    for (const profile of active) {
      const inDepartment = isSameDepartment(profile.department, department) || leadsDepartment(profile, department)
      const isLeadership = LEADERSHIP_DEPARTMENTS.some((dept) => leadsDepartment(profile, dept))
      const email = (profile.company_email || profile.additional_email || "").trim()
      if ((inDepartment || isLeadership) && email && !recipients.has(profile.id)) {
        recipients.set(profile.id, { userId: profile.id, email, name: profile.full_name || "" })
      }
    }
    if (recipients.size === 0) return json({ skipped: true, reason: "no_recipients", department })

    const meetingDateIso = await resolveEffectiveMeetingDateIso(supabase, week, year)
    const meetingDateLabel = formatMeetingDateLabel(meetingDateIso)
    const subject = `Knowledge Sharing Session Next Week — ${department}`

    if (previewTo) {
      await sendEmail({
        from: EDGE_SENDERS.system,
        ...EDGE_MAIL_ROUTING.meetings,
        to: previewTo,
        subject,
        html: buildHtml({ department, meetingDateLabel, recipientName: "Colleague" }),
        traceLabel: `kss-heads-up:preview:${previewTo}`,
      })
      return json({
        preview: true,
        sentTo: previewTo,
        department,
        meetingDate: meetingDateIso,
        wouldSendTo: Array.from(recipients.values()).map((r) => r.name || r.email),
      })
    }
    const message = `${department} presents the Knowledge Sharing Session at the General Weekly Meeting on ${meetingDateLabel}.`

    let sent = 0
    for (const [index, recipient] of Array.from(recipients.values()).entries()) {
      try {
        await sendEmail({
          from: EDGE_SENDERS.system,
          ...EDGE_MAIL_ROUTING.meetings,
          to: recipient.email,
          subject,
          html: buildHtml({ department, meetingDateLabel, recipientName: recipient.name }),
          traceLabel: `kss-heads-up:${index + 1}/${recipients.size}:${recipient.email}`,
        })
        sent++
      } catch (err) {
        console.error(`[kss-heads-up] email to ${recipient.email} failed:`, err instanceof Error ? err.message : err)
        continue
      }

      const { error: notifyError } = await supabase.from("notifications").insert({
        user_id: recipient.userId,
        type: "announcement",
        category: "meetings",
        priority: "normal",
        title: "Knowledge Sharing Session next week",
        message,
        link_url: "/reports/kss",
      })
      if (notifyError) console.error(`[kss-heads-up] in-app notification failed: ${notifyError.message}`)
    }

    // Partial success still counts, so nobody who already got it is mailed twice.
    if (sent > 0) {
      const { error: markError } = await supabase.rpc("mark_kss_heads_up_sent", {
        p_week: week,
        p_year: year,
        p_recipient_count: sent,
      })
      if (markError) console.error(`[kss-heads-up] failed to mark sent: ${markError.message}`)
    }

    console.log("[kss-heads-up] done", JSON.stringify({ week, year, department, recipients: recipients.size, sent }))
    return json({ department, recipients: recipients.size, sent })
  } catch (err) {
    console.error("[kss-heads-up] error:", err instanceof Error ? err.message : err)
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
