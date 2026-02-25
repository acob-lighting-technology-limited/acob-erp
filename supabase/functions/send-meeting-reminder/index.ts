import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ReminderType = "meeting" | "knowledge_sharing" | "admin_broadcast"

type KnowledgePresenter = {
  id?: string
  full_name?: string
  department?: string | null
}

const RESEND_MAX_REQ_PER_SEC = 2
const SEND_INTERVAL_MS = Math.ceil(1000 / RESEND_MAX_REQ_PER_SEC) + 100 // safety margin
const MAX_429_RETRIES = 5

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(error: any): boolean {
  if (!error) return false
  const statusCode = Number(error?.statusCode || error?.status || 0)
  const name = String(error?.name || "").toLowerCase()
  const msg = String(error?.message || "").toLowerCase()
  return statusCode === 429 || name.includes("rate_limit") || msg.includes("too many requests")
}

async function sendWithRetry(
  resend: Resend,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ data?: any; error?: any }> {
  let attempt = 0
  while (attempt <= MAX_429_RETRIES) {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })

    if (!error) return { data }

    if (!isRateLimitError(error) || attempt === MAX_429_RETRIES) {
      return { error }
    }

    // Backoff: 1s, 2s, 3s... for 429 bursts.
    const backoffMs = 1000 * (attempt + 1)
    console.warn(`[meeting-reminder] Rate limit for ${to}. Retry ${attempt + 1}/${MAX_429_RETRIES} in ${backoffMs}ms`)
    await sleep(backoffMs)
    attempt += 1
  }

  return { error: { message: "Unexpected retry flow termination" } }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildKnowledgeSharingAgendaLabel(presenter?: KnowledgePresenter, department?: string): string {
  const base = "Knowledge Sharing Session (30 minutes)"
  const presenterName = presenter?.full_name?.trim()
  const dept = (department || presenter?.department || "").trim()

  if (presenterName && dept) return `${base} - ${dept}: ${presenterName}`
  if (presenterName) return `${base} - ${presenterName}`
  if (dept) return `${base} - ${dept}`
  return base
}

function normalizeMeetingAgenda(
  agendaInput: string[] | string | undefined,
  presenter?: KnowledgePresenter,
  department?: string
): string[] {
  const parsedAgenda = Array.isArray(agendaInput)
    ? agendaInput
    : typeof agendaInput === "string"
      ? agendaInput
          .split(/\r?\n/)
          .map((line) => line.replace(/^\d+\.\s*/, "").trim())
          .filter(Boolean)
      : []

  const fallbackAgenda = [
    "Opening Prayer",
    "Knowledge Sharing Session (30 minutes)",
    "Departmental Updates",
    "Progress on Ongoing Projects",
    "Upcoming Events and Deadlines",
    "Any Other Business",
    "Adjournment",
  ]

  const baseAgenda = parsedAgenda.length > 0 ? parsedAgenda : fallbackAgenda
  const knowledgeLine = buildKnowledgeSharingAgendaLabel(presenter, department)
  const knowledgePattern = /^Knowledge Sharing Session\s*\(30\s*minutes?\)/i
  const foundIndex = baseAgenda.findIndex((item) => knowledgePattern.test(item))

  if (foundIndex >= 0) {
    return baseAgenda.map((item, idx) => (idx === foundIndex ? knowledgeLine : item))
  }
  if (presenter?.full_name || department) {
    const insertIndex = Math.min(1, baseAgenda.length)
    return [...baseAgenda.slice(0, insertIndex), knowledgeLine, ...baseAgenda.slice(insertIndex)]
  }
  return baseAgenda
}

function buildMeetingReminderHtml(
  meetingDate: string,
  meetingTime: string,
  teamsLink: string,
  agenda: string[]
): string {
  let agendaHtml = ""
  for (let i = 0; i < agenda.length; i++) {
    agendaHtml +=
      '<tr><td style="padding: 10px 18px; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td valign="top" style="width: 36px; padding: 0 12px 0 0;">' +
      '<span style="display: inline-block; background: #000; color: #16a34a; font-weight: 700; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">' +
      (i + 1) +
      "</span>" +
      "</td>" +
      '<td valign="top" style="padding: 2px 0 0 0; color: #374151; line-height: 1.5;">' +
      agenda[i] +
      "</td>" +
      "</tr></table>" +
      "</td></tr>"
  }

  return (
    "<!DOCTYPE html>" +
    '<html lang="en">' +
    "<head>" +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>Meeting Reminder</title>" +
    "<style>" +
    'body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }' +
    ".email-shell { max-width: 600px; margin: 0 auto; overflow: hidden; }" +
    ".outer-header { background: #0f2d1f; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }" +
    ".wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }" +
    ".title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 14px; }" +
    ".text { font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 18px 0; }" +
    ".card { margin: 22px 0; border: 1px solid #d1d5db; overflow: hidden; background: #f9fafb; border-radius: 8px; }" +
    ".card-header { padding: 12px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #d1d5db; background: #eff6ff; color: #1e40af; }" +
    ".cta { text-align: center; margin: 28px 0; }" +
    ".button { display: inline-block; background: #1e40af; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }" +
    ".note-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; font-size: 14px; color: #92400e; margin: 20px 0; line-height: 1.6; }" +
    ".support { text-align: center; font-size: 14px; color: #4b5563; margin-top: 24px; line-height: 1.5; }" +
    ".support a { color: #16a34a; font-weight: 600; text-decoration: none; }" +
    ".footer { background: #0f2d1f; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }" +
    ".footer strong { color: #fff; }" +
    ".footer-system { color: #16a34a; font-weight: 600; }" +
    ".footer-note { color: #9ca3af; font-style: italic; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="email-shell">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2d1f" style="background:#0f2d1f !important;background-color:#0f2d1f !important;border-bottom:3px solid #16a34a;">' +
    '<tr><td align="center" style="padding:20px 0;background:#0f2d1f !important;background-color:#0f2d1f !important;">' +
    '<img src="https://erp.acoblighting.com/images/acob-logo-dark.png" height="40" alt="ACOB Lighting">' +
    "</td></tr></table>" +
    '<div class="wrapper">' +
    '<div class="title">Reminder for General Weekly Meeting</div>' +
    '<p class="text">Dear All,</p>' +
    '<p class="text">' +
    "Please find attached the agenda for our general weekly meeting, scheduled to take place tomorrow " +
    "<strong>" +
    meetingDate +
    "</strong>, at <strong>" +
    meetingTime +
    "</strong>. " +
    "You can access the meeting using the link below:" +
    "</p>" +
    '<div class="cta">' +
    '<a href="' +
    teamsLink +
    '" class="button" style="color: #fff;">Join via Microsoft Teams</a>' +
    "</div>" +
    '<div class="card">' +
    '<div class="card-header">Agenda</div>' +
    '<table style="width: 100%; border-collapse: collapse;">' +
    agendaHtml +
    "</table>" +
    "</div>" +
    '<div class="note-box">' +
    "<strong>Note:</strong> Your attendance is crucial to ensure we're all on the same page and can collaborate effectively. " +
    "Please join on time, and feel free to reach out to me or any team member if you have questions or concerns." +
    "</div>" +
    '<p class="text" style="text-align: center; font-weight: 600; color: #16a34a;">Looking forward to seeing you there.</p>' +
    '<div class="support">' +
    "If you have any questions, please contact<br>" +
    '<a href="mailto:ict@acoblighting.com">ict@acoblighting.com</a>' +
    "</div>" +
    "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2d1f" style="background:#0f2d1f !important;background-color:#0f2d1f !important;border-top:3px solid #16a34a;">' +
    '<tr><td align="center" style="padding:20px;background:#0f2d1f !important;background-color:#0f2d1f !important;font-size:11px;color:#9ca3af;">' +
    '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>' +
    "ACOB Admin &amp; HR Department<br>" +
    '<span style="color:#16a34a;font-weight:600;">Meeting Management System</span>' +
    "<br><br>" +
    '<i style="color:#9ca3af;">This is an automated system notification. Please do not reply directly to this email.</i>' +
    "</td></tr></table>" +
    "</div>" +
    "</body>" +
    "</html>"
  )
}

function buildKnowledgeSharingHtml(sessionDate: string, sessionTime: string, duration: string): string {
  return (
    "<!DOCTYPE html>" +
    '<html lang="en">' +
    "<head>" +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>Knowledge Sharing Reminder</title>" +
    "<style>" +
    'body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }' +
    ".email-shell { max-width: 600px; margin: 0 auto; overflow: hidden; }" +
    ".outer-header { background: #0f2d1f; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }" +
    ".wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }" +
    ".title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 14px; }" +
    ".text { font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 18px 0; }" +
    ".note-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; font-size: 14px; color: #92400e; margin: 20px 0; line-height: 1.6; text-align: center; }" +
    ".alert-badge { display: inline-block; background: #dc2626; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }" +
    ".support { text-align: center; font-size: 14px; color: #4b5563; margin-top: 24px; line-height: 1.5; }" +
    ".support a { color: #16a34a; font-weight: 600; text-decoration: none; }" +
    ".footer { background: #0f2d1f; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }" +
    ".footer strong { color: #fff; }" +
    ".footer-system { color: #16a34a; font-weight: 600; }" +
    ".footer-note { color: #9ca3af; font-style: italic; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="email-shell">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2d1f" style="background:#0f2d1f !important;background-color:#0f2d1f !important;border-bottom:3px solid #16a34a;">' +
    '<tr><td align="center" style="padding:20px 0;background:#0f2d1f !important;background-color:#0f2d1f !important;">' +
    '<img src="https://erp.acoblighting.com/images/acob-logo-dark.png" height="40" alt="ACOB Lighting">' +
    "</td></tr></table>" +
    '<div class="wrapper">' +
    '<div class="title">Reminder: Knowledge Sharing Session</div>' +
    '<p class="text">Dear Team,</p>' +
    '<p class="text">' +
    "This is a reminder that the <strong>Knowledge Sharing Session</strong> will hold on " +
    "<strong>" +
    sessionDate +
    "</strong>, commencing promptly at " +
    "<strong>" +
    sessionTime +
    "</strong> and will run for <strong>" +
    duration +
    "</strong>." +
    "</p>" +
    '<p class="text">Immediately after, the <strong>General Meeting</strong> will commence.</p>' +
    '<p class="text">Kindly ensure you are seated and ready on time.</p>' +
    '<div class="note-box">' +
    '<span class="alert-badge">Mandatory</span><br><br>' +
    "Attendance is mandatory for all team members." +
    "</div>" +
    '<div class="support">' +
    "If you have any questions, please contact<br>" +
    '<a href="mailto:ict@acoblighting.com">ict@acoblighting.com</a>' +
    "</div>" +
    "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2d1f" style="background:#0f2d1f !important;background-color:#0f2d1f !important;border-top:3px solid #16a34a;">' +
    '<tr><td align="center" style="padding:20px;background:#0f2d1f !important;background-color:#0f2d1f !important;font-size:11px;color:#9ca3af;">' +
    '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>' +
    "ACOB Admin &amp; HR Department<br>" +
    '<span style="color:#16a34a;font-weight:600;">Meeting Management System</span>' +
    "<br><br>" +
    '<i style="color:#9ca3af;">This is an automated system notification. Please do not reply directly to this email.</i>' +
    "</td></tr></table>" +
    "</div>" +
    "</body>" +
    "</html>"
  )
}

function buildAdminBroadcastHtml(title: string, bodyHtml: string, department: string, preparedByName: string): string {
  const safeDepartment = escapeHtml(department.trim() || "Admin & HR")
  const safeTitle = escapeHtml(title)
  const safePreparedBy = escapeHtml(preparedByName.trim() || "ACOB Team")
  return (
    "<!DOCTYPE html>" +
    '<html lang="en">' +
    "<head>" +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>Admin Broadcast</title>" +
    "<style>" +
    'body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }' +
    ".email-shell { max-width: 600px; margin: 0 auto; overflow: hidden; }" +
    ".wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }" +
    ".title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 14px; }" +
    ".text { font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 12px 0; }" +
    ".body-content { font-size: 15px; color: #374151; line-height: 1.7; }" +
    ".body-content p { margin: 0 0 12px 0; }" +
    ".body-content ul, .body-content ol { margin: 0 0 12px 20px; }" +
    ".body-content a { color: #1e40af; text-decoration: underline; }" +
    ".footer { background: #0f2d1f; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }" +
    ".footer strong { color: #fff; }" +
    ".footer-system { color: #16a34a; font-weight: 600; }" +
    ".footer-note { color: #9ca3af; font-style: italic; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="email-shell">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2d1f" style="background:#0f2d1f !important;background-color:#0f2d1f !important;border-bottom:3px solid #16a34a;">' +
    '<tr><td align="center" style="padding:20px 0;background:#0f2d1f !important;background-color:#0f2d1f !important;">' +
    '<img src="https://erp.acoblighting.com/images/acob-logo-dark.png" height="40" alt="ACOB Lighting">' +
    "</td></tr></table>" +
    '<div class="wrapper">' +
    '<div class="title">' +
    safeTitle +
    "</div>" +
    '<div class="body-content">' +
    bodyHtml +
    "</div>" +
    "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f2d1f" style="background:#0f2d1f !important;background-color:#0f2d1f !important;border-top:3px solid #16a34a;">' +
    '<tr><td align="center" style="padding:20px;background:#0f2d1f !important;background-color:#0f2d1f !important;font-size:11px;color:#9ca3af;">' +
    '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>' +
    "Prepared by " +
    safePreparedBy +
    "<br>" +
    safeDepartment +
    " Department<br>" +
    '<span style="color:#16a34a;font-weight:600;">Communications System</span>' +
    "<br><br>" +
    '<i style="color:#9ca3af;">This is an automated system notification. Please do not reply directly to this email.</i>' +
    "</td></tr></table>" +
    "</div>" +
    "</body>" +
    "</html>"
  )
}

function sanitizeBroadcastHtml(rawHtml: string): string {
  if (!rawHtml?.trim()) return ""
  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed|form|input|button|textarea|select)[\s\S]*?>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+=(["']).*?\1/gi, "")
    .replace(/\son\w+=\S+/gi, "")
    .replace(/javascript:/gi, "")
    .trim()
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401 })

    const resend = new Resend(RESEND_API_KEY)
    const body = await req.json()

    const {
      type,
      recipients,
      meetingDate,
      meetingTime,
      teamsLink,
      agenda,
      sessionDate,
      sessionTime,
      duration,
      knowledgeSharingDepartment,
      knowledgeSharingPresenter,
      broadcastSubject,
      broadcastBodyHtml,
      broadcastDepartment,
      broadcastPreparedByName,
    } = body as {
      type: ReminderType
      recipients: string[]
      meetingDate?: string
      meetingTime?: string
      teamsLink?: string
      agenda?: string[]
      sessionDate?: string
      sessionTime?: string
      duration?: string
      knowledgeSharingDepartment?: string
      knowledgeSharingPresenter?: KnowledgePresenter
      broadcastSubject?: string
      broadcastBodyHtml?: string
      broadcastDepartment?: string
      broadcastPreparedByName?: string
    }

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), { status: 400 })
    }

    let html: string
    let subject: string
    let from = "ACOB Admin & HR <notifications@acoblighting.com>"

    if (type === "meeting") {
      const normalizedAgenda = normalizeMeetingAgenda(agenda, knowledgeSharingPresenter, knowledgeSharingDepartment)

      subject = "Reminder for General Weekly Meeting"
      html = buildMeetingReminderHtml(
        meetingDate || "Monday",
        meetingTime || "8:30 AM",
        teamsLink || "",
        normalizedAgenda
      )
    } else if (type === "knowledge_sharing") {
      subject = "Reminder: Knowledge Sharing Session"
      html = buildKnowledgeSharingHtml(sessionDate || "Monday", sessionTime || "8:30am", duration || "30 minutes")
    } else {
      const cleanBody = sanitizeBroadcastHtml(broadcastBodyHtml || "")
      if (!cleanBody) {
        return new Response(JSON.stringify({ error: "Broadcast body is required" }), { status: 400 })
      }
      const department = (broadcastDepartment || "Admin & HR").trim() || "Admin & HR"
      const preparedBy = (broadcastPreparedByName || "").trim() || "ACOB Team"
      subject = (broadcastSubject || "Administrative Notice").trim() || "Administrative Notice"
      html = buildAdminBroadcastHtml(subject, cleanBody, department, preparedBy)
      from = `ACOB ${department} <notifications@acoblighting.com>`
    }

    console.log("[meeting-reminder] Sending " + type + " to " + recipients.length + " recipients")

    const results: any[] = []
    for (const to of recipients) {
      const { data, error } = await sendWithRetry(resend, from, to, subject, html)
      if (error) {
        console.error("[meeting-reminder] Failed to send to " + to + ":", JSON.stringify(error))
        results.push({ to, success: false, error })
      } else {
        console.log("[meeting-reminder] Sent to " + to + ". ID: " + data?.id)
        results.push({ to, success: true, emailId: data?.id })
      }

      // Throttle base send cadence to stay under provider limits.
      await sleep(SEND_INTERVAL_MS)
    }

    return new Response(JSON.stringify({ success: true, type, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err: any) {
    console.error("[send-meeting-reminder] Error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
