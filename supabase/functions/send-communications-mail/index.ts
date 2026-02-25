import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const RESEND_MAX_REQ_PER_SEC = 2
const SEND_INTERVAL_MS = Math.ceil(1000 / RESEND_MAX_REQ_PER_SEC) + 100
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

    const backoffMs = 1000 * (attempt + 1)
    console.warn(
      `[communications-mail] Rate limit for ${to}. Retry ${attempt + 1}/${MAX_429_RETRIES} in ${backoffMs}ms`
    )
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

function sanitizeBroadcastHtml(rawHtml: string): string {
  if (!rawHtml?.trim()) return ""
  return rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed|form|input|button|textarea|select)[\s\S]*?>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+=("|').*?\1/gi, "")
    .replace(/\son\w+=\S+/gi, "")
    .replace(/javascript:/gi, "")
    .trim()
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
    ".body-content { font-size: 15px; color: #374151; line-height: 1.7; }" +
    ".body-content p { margin: 0 0 12px 0; }" +
    ".body-content ul, .body-content ol { margin: 0 0 12px 20px; }" +
    ".body-content a { color: #1e40af; text-decoration: underline; }" +
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401 })

    const resend = new Resend(RESEND_API_KEY)
    const body = await req.json()

    const recipients = body.recipients as string[] | undefined
    const broadcastSubject = body.broadcastSubject as string | undefined
    const broadcastBodyHtml = body.broadcastBodyHtml as string | undefined
    const broadcastDepartment = body.broadcastDepartment as string | undefined
    const broadcastPreparedByName = body.broadcastPreparedByName as string | undefined

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), { status: 400 })
    }

    const cleanBody = sanitizeBroadcastHtml(broadcastBodyHtml || "")
    if (!cleanBody) {
      return new Response(JSON.stringify({ error: "Broadcast body is required" }), { status: 400 })
    }

    const department = (broadcastDepartment || "Admin & HR").trim() || "Admin & HR"
    const preparedBy = (broadcastPreparedByName || "").trim() || "ACOB Team"
    const subject = (broadcastSubject || "Administrative Notice").trim() || "Administrative Notice"
    const html = buildAdminBroadcastHtml(subject, cleanBody, department, preparedBy)
    const from = `ACOB ${department} <notifications@acoblighting.com>`

    console.log("[communications-mail] Sending admin_broadcast to " + recipients.length + " recipients")

    const results: any[] = []
    for (const to of recipients) {
      const { data, error } = await sendWithRetry(resend, from, to, subject, html)
      if (error) {
        console.error("[communications-mail] Failed to send to " + to + ":", JSON.stringify(error))
        results.push({ to, success: false, error })
      } else {
        console.log("[communications-mail] Sent to " + to + ". ID: " + data?.id)
        results.push({ to, success: true, emailId: data?.id })
      }

      await sleep(SEND_INTERVAL_MS)
    }

    return new Response(JSON.stringify({ success: true, type: "admin_broadcast", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err: any) {
    console.error("[send-communications-mail] Error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
