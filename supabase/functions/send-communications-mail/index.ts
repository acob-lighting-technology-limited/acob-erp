import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { writeEdgeAuditLog } from "../_shared/audit.ts"
import { sendEmail } from "../_shared/email.ts"
import { isEdgeSystemEmailEnabled } from "../_shared/notification-gateway.ts"
import { sanitizeHtml } from "../_shared/sanitize-html.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const DEFAULT_SENDER_EMAIL = Deno.env.get("NOTIFICATION_SENDER_EMAIL") || "notifications@acoblighting.com"

type BroadcastRequestBody = {
  recipients?: string[]
  broadcastSubject?: string
  broadcastBodyHtml?: string
  broadcastDepartment?: string
  broadcastPreparedByName?: string
  broadcastPreparedByDesignation?: string
  broadcastPreparedByDepartment?: string
  requestedByUserId?: string
  attachments?: {
    filename?: string
    content?: string
  }[]
}

type DeliveryResult = {
  to: string
  success: boolean
  emailId?: string | null
  error?: unknown
}

type MailAttachment = {
  filename: string
  content: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return "Unknown error"
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function normalizeDepartmentLabel(input: string): string {
  return input.replace(/^ACOB\s+/i, "").trim() || "Admin & HR"
}

function buildBroadcastSender(department: string): string {
  const senderDepartment = normalizeDepartmentLabel(department)
  return `ACOB ${senderDepartment} <${DEFAULT_SENDER_EMAIL}>`
}

function withSubjectPrefix(moduleName: string, subject: string): string {
  return String(subject || "").trim() || "Notification"
}

function buildAdminBroadcastHtml(
  title: string,
  bodyHtml: string,
  department: string,
  preparedByName: string,
  preparedByDesignation?: string | null,
  preparedByDepartment?: string | null
): string {
  const displayDepartment = normalizeDepartmentLabel(preparedByDepartment || department)
  const safeDepartment = escapeHtml(displayDepartment)
  const safeTitle = escapeHtml(title)
  const safePreparedBy = escapeHtml(preparedByName.trim() || "ACOB Team")
  const safeDesignation = escapeHtml((preparedByDesignation || "").trim())

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
    '<span style="color:#d1d5db;">Prepared by ' +
    safePreparedBy +
    "</span><br>" +
    (safeDesignation ? safeDesignation + "<br>" : "") +
    safeDepartment +
    "<br>" +
    '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong>' +
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const communicationsMailEnabled = await isEdgeSystemEmailEnabled(supabase, "communications")
    if (!communicationsMailEnabled) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "communications_email_disabled" }), {
        status: 200,
      })
    }

    const body = (await req.json()) as BroadcastRequestBody

    const recipients = body.recipients as string[] | undefined
    const broadcastSubject = body.broadcastSubject as string | undefined
    const broadcastBodyHtml = body.broadcastBodyHtml as string | undefined
    const broadcastDepartment = body.broadcastDepartment as string | undefined
    const broadcastPreparedByName = body.broadcastPreparedByName as string | undefined
    const broadcastPreparedByDesignation = body.broadcastPreparedByDesignation as string | undefined
    const broadcastPreparedByDepartment = body.broadcastPreparedByDepartment as string | undefined
    const requestedByUserId = (body.requestedByUserId as string | undefined) || null
    const attachments = Array.isArray(body.attachments)
      ? body.attachments
          .map((attachment) => ({
            filename: String(attachment?.filename || "").trim(),
            content: String(attachment?.content || "").trim(),
          }))
          .filter((attachment): attachment is MailAttachment => Boolean(attachment.filename && attachment.content))
      : []

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), { status: 400 })
    }

    const cleanBody = sanitizeHtml(broadcastBodyHtml || "")
    if (!cleanBody) {
      return new Response(JSON.stringify({ error: "Broadcast body is required" }), { status: 400 })
    }

    const department = (broadcastDepartment || "Admin & HR").trim() || "Admin & HR"
    const preparedBy = (broadcastPreparedByName || "").trim() || "ACOB Team"
    const subject = withSubjectPrefix(
      "Communications",
      (broadcastSubject || "Administrative Notice").trim() || "Administrative Notice"
    )
    const html = buildAdminBroadcastHtml(
      subject,
      cleanBody,
      department,
      preparedBy,
      broadcastPreparedByDesignation,
      broadcastPreparedByDepartment
    )
    const from = buildBroadcastSender(department)

    console.log("[communications-mail] Sending admin_broadcast to " + recipients.length + " recipients")

    const results: DeliveryResult[] = []
    for (const to of recipients) {
      try {
        const data = await sendEmail({ from, to, subject, html, attachments })
        console.log("[communications-mail] Sent to " + to + ". ID: " + data.id)
        results.push({ to, success: true, emailId: data.id })
      } catch (error) {
        console.error("[communications-mail] Failed to send to " + to + ":", JSON.stringify(error))
        results.push({ to, success: false, error })
      }
    }

    try {
      const successCount = results.filter((r) => r.success).length
      const failureCount = results.length - successCount
      const auditEntityId = crypto.randomUUID()
      await writeEdgeAuditLog(supabase, {
        action: "communications_broadcast_sent",
        entityType: "communications_mail",
        entityId: auditEntityId,
        actorId: requestedByUserId,
        department,
        source: "edge",
        route: "/functions/send-communications-mail",
        metadata: {
          reminder_type: "admin_broadcast",
          recipient_count: recipients.length,
          success_count: successCount,
          failure_count: failureCount,
          subject,
          prepared_by: preparedBy,
          prepared_by_designation: broadcastPreparedByDesignation || null,
          prepared_by_department: broadcastPreparedByDepartment || department,
          attachment_count: attachments.length,
        },
      })
    } catch (auditErr) {
      console.error("[communications-mail] Failed to write audit log:", auditErr)
    }

    return new Response(JSON.stringify({ success: true, type: "admin_broadcast", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err: unknown) {
    console.error("[send-communications-mail] Error:", err)
    return new Response(JSON.stringify({ error: getErrorMessage(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
