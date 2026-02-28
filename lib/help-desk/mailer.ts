import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"

interface HelpDeskMailPayload {
  userIds: string[]
  subject: string
  title: string
  message: string
  ticketNumber: string
  ctaPath?: string
}

function buildEmailHtml(payload: HelpDeskMailPayload) {
  const ctaUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://erp.acoblighting.com"}${payload.ctaPath || "/portal/help-desk"}`

  return `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
    <h2 style="margin:0 0 12px;color:#0f172a;">${payload.title}</h2>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6;">${payload.message}</p>
    <p style="margin:0 0 20px;color:#0f172a;"><strong>Ticket:</strong> ${payload.ticketNumber}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#166534;color:#fff;padding:10px 14px;text-decoration:none;border-radius:8px;">Open Help Desk</a>
  </div>
  `
}

export async function sendHelpDeskMail(payload: HelpDeskMailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const overrideRecipient = process.env.HELP_DESK_TEST_RECIPIENT?.trim().toLowerCase()
  if (overrideRecipient) {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: "ACOB ERP <notifications@acoblighting.com>",
      to: [overrideRecipient],
      subject: payload.subject,
      html: buildEmailHtml(payload),
    })
    return
  }

  const uniqueIds = Array.from(new Set(payload.userIds.filter(Boolean)))
  if (!uniqueIds.length) return

  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, company_email, additional_email")
    .in("id", uniqueIds)

  const recipients = Array.from(
    new Set(
      (profiles || [])
        .flatMap((p: any) => [p.company_email, p.additional_email])
        .filter((email: any) => typeof email === "string" && email.trim())
        .map((email: string) => email.toLowerCase())
    )
  )

  if (!recipients.length) return

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: "ACOB ERP <notifications@acoblighting.com>",
    to: recipients,
    subject: payload.subject,
    html: buildEmailHtml(payload),
  })
}
