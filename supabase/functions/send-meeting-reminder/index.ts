import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ReminderType = "meeting" | "knowledge_sharing"

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
      '<span style="display: inline-block; background: #000; color: #16a34a; font-weight: 700; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 12px;">' +
      (i + 1) +
      "</span>" +
      agenda[i] +
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
    ".outer-header { background: #000; width: 100%; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }" +
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
    ".footer { background: #000; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }" +
    ".footer strong { color: #fff; }" +
    ".footer-system { color: #16a34a; font-weight: 600; }" +
    ".footer-note { color: #9ca3af; font-style: italic; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="outer-header">' +
    '<img src="https://erp.acoblighting.com/images/acob-logo-dark.webp" height="40" alt="ACOB Lighting">' +
    "</div>" +
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
    '<div class="footer">' +
    "<strong>ACOB Lighting Technology Limited</strong><br>" +
    "ACOB Admin &amp; HR Department<br>" +
    '<span class="footer-system">Meeting Management System</span>' +
    "<br><br>" +
    '<i class="footer-note">This is an automated system notification. Please do not reply directly to this email.</i>' +
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
    ".outer-header { background: #000; width: 100%; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }" +
    ".wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }" +
    ".title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 14px; }" +
    ".text { font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 18px 0; }" +
    ".note-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; font-size: 14px; color: #92400e; margin: 20px 0; line-height: 1.6; text-align: center; }" +
    ".alert-badge { display: inline-block; background: #dc2626; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }" +
    ".support { text-align: center; font-size: 14px; color: #4b5563; margin-top: 24px; line-height: 1.5; }" +
    ".support a { color: #16a34a; font-weight: 600; text-decoration: none; }" +
    ".footer { background: #000; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }" +
    ".footer strong { color: #fff; }" +
    ".footer-system { color: #16a34a; font-weight: 600; }" +
    ".footer-note { color: #9ca3af; font-style: italic; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="outer-header">' +
    '<img src="https://erp.acoblighting.com/images/acob-logo-dark.webp" height="40" alt="ACOB Lighting">' +
    "</div>" +
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
    '<div class="footer">' +
    "<strong>ACOB Lighting Technology Limited</strong><br>" +
    "ACOB Admin &amp; HR Department<br>" +
    '<span class="footer-system">Meeting Management System</span>' +
    "<br><br>" +
    '<i class="footer-note">This is an automated system notification. Please do not reply directly to this email.</i>' +
    "</div>" +
    "</body>" +
    "</html>"
  )
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401 })

    const resend = new Resend(RESEND_API_KEY)
    const body = await req.json()

    const { type, recipients, meetingDate, meetingTime, teamsLink, agenda, sessionDate, sessionTime, duration } =
      body as {
        type: ReminderType
        recipients: string[]
        meetingDate?: string
        meetingTime?: string
        teamsLink?: string
        agenda?: string[]
        sessionDate?: string
        sessionTime?: string
        duration?: string
      }

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), { status: 400 })
    }

    let html: string
    let subject: string

    if (type === "meeting") {
      subject = "Reminder for General Weekly Meeting"
      html = buildMeetingReminderHtml(
        meetingDate || "Monday",
        meetingTime || "9:00 AM",
        teamsLink || "",
        agenda || [
          "Opening Prayer",
          "Departmental updates",
          "Progress on ongoing projects",
          "Upcoming Events and Deadline",
          "Any other business",
          "Adjournment",
        ]
      )
    } else {
      subject = "Reminder: Knowledge Sharing Session"
      html = buildKnowledgeSharingHtml(sessionDate || "Monday", sessionTime || "8:30am", duration || "30 minutes")
    }

    console.log("[meeting-reminder] Sending " + type + " to " + recipients.length + " recipients")

    const results: any[] = []
    for (const to of recipients) {
      const { data, error } = await resend.emails.send({
        from: "ACOB Admin & HR <notifications@acoblighting.com>",
        to,
        subject,
        html,
      })
      if (error) {
        console.error("[meeting-reminder] Failed to send to " + to + ":", JSON.stringify(error))
        results.push({ to, success: false, error })
      } else {
        console.log("[meeting-reminder] Sent to " + to + ". ID: " + data?.id)
        results.push({ to, success: true, emailId: data?.id })
      }
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
