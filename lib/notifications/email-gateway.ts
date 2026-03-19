import { Resend } from "resend"
import type { SupabaseClient } from "@supabase/supabase-js"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"
import { ORG_NOTIFICATION_SENDER } from "@/lib/org-config"
import type { Database } from "@/types/database"

export const DEFAULT_NOTIFICATION_SENDER = ORG_NOTIFICATION_SENDER

interface SendEmailInput {
  to: string[]
  subject: string
  html: string
  from?: string
}

function normalizeRecipientEmails(emails: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) => (email || "").trim().toLowerCase())
        .filter((email) => email.length > 0 && email.includes("@"))
    )
  )
}

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

export async function sendNotificationEmail(input: SendEmailInput) {
  const resend = getResendClient()
  if (!resend) return { sent: false as const, reason: "missing_resend_key" as const }

  const recipients = normalizeRecipientEmails(input.to)
  if (!recipients.length) return { sent: false as const, reason: "no_recipients" as const }

  const { error } = await resend.emails.send({
    from: input.from || DEFAULT_NOTIFICATION_SENDER,
    to: recipients,
    subject: input.subject,
    html: input.html,
  })

  if (error) throw new Error(error.message || "Failed to send email")
  return { sent: true as const, recipients }
}

export async function resolveActiveLeadRecipientEmails(supabaseClient: SupabaseClient<Database>) {
  const recipients = await resolveActiveLeadRecipients(supabaseClient)
  return recipients.flatMap((lead) => lead.emails)
}

export async function resolveActiveLeadRecipients(supabaseClient: SupabaseClient<Database>) {
  const { data: leadProfiles, error } = await applyAssignableStatusFilter(
    supabaseClient
      .from("profiles")
      .select("id, company_email, additional_email, is_department_lead")
      .eq("is_department_lead", true),
    { allowLegacyNullStatus: false }
  )

  if (error) throw new Error(error.message || "Failed to load lead recipients")

  return (
    (leadProfiles || []) as Array<{ id: string; company_email?: string | null; additional_email?: string | null }>
  )
    .map((lead) => ({
      id: lead.id,
      emails: normalizeRecipientEmails([lead.company_email, lead.additional_email]),
    }))
    .filter((lead) => lead.emails.length > 0)
}
