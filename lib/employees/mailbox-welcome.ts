import "server-only"
import crypto from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { renderInternalNotificationEmail } from "@/lib/email-templates/internal-notification"
import { renderWelcomeEmail } from "@/lib/email-templates/welcome"
import { logger } from "@/lib/logger"
import { isSystemNotificationChannelEnabled } from "@/lib/notifications/delivery-policy"
import {
  sendNotificationEmailWithRetry,
  sendNotificationEmailsIndividuallyWithRetry,
} from "@/lib/notifications/email-gateway"
import { withSubjectPrefix } from "@/lib/notifications/subject-policy"
import { resolveOnboardedNoticeRecipients } from "@/lib/onboarding/recipients"
import { ORG_EMAIL_SENDERS, ORG_MAIL_ROUTING } from "@/lib/org-config"

const log = logger("mailbox-welcome")
const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000

export const WELCOME_PROFILE_COLUMNS =
  "id, first_name, last_name, employee_number, department, designation, company_email, personal_email, office_location, residential_address, phone_number, mailbox_credentials_sent_at"

export interface WelcomeProfile {
  id: string
  first_name: string | null
  last_name: string | null
  employee_number: string | null
  department: string | null
  designation: string | null
  company_email: string | null
  personal_email: string | null
  office_location: string | null
  residential_address: string | null
  phone_number: string | null
  mailbox_credentials_sent_at: string | null
}

export interface PreparedBy {
  name: string
  designation: string | null
  department: string
}

export type WelcomeResult =
  | { ok: true; dispatchedAt: string; recipient: string; firstDispatch: boolean; warnings: string[] }
  | { ok: false; status: number; error: string }

/**
 * Sends a new employee their welcome letter at their PERSONAL email — webmail
 * password plus a one-time Matrix activation link — and, on the first dispatch
 * only, tells HCS, the Admin & HR lead and their department lead they are
 * onboarded. A resend (wrong password, lost mail) concerns the employee alone
 * and must not re-announce the hire.
 *
 * Shared by approval (mailbox created automatically) and "Send webmail
 * credentials" (manual or retry).
 */
export async function sendMailboxWelcome(
  dataClient: SupabaseClient,
  params: { profile: WelcomeProfile; mailboxPassword: string; preparedBy: PreparedBy }
): Promise<WelcomeResult> {
  const { profile, mailboxPassword, preparedBy } = params
  const id = profile.id

  if (!profile.personal_email) {
    return { ok: false, status: 422, error: "Employee does not have a personal email on file to receive credentials" }
  }
  if (!profile.company_email) {
    return { ok: false, status: 422, error: "Employee does not have a company email assigned" }
  }

  const onboardingMailEnabled = await isSystemNotificationChannelEnabled(dataClient, "onboarding", "email")
  if (!onboardingMailEnabled) {
    return { ok: false, status: 400, error: "Onboarding email notifications are currently disabled in system settings" }
  }

  // Account activation is not a password reset. Generate a one-time, opaque
  // activation token for the welcome letter so a new colleague is never sent
  // Supabase's recovery email merely to choose their first password.
  const setupToken = crypto.randomBytes(32).toString("base64url")
  const setupTokenHash = crypto.createHash("sha256").update(setupToken).digest("hex")
  const setupTokenExpiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS).toISOString()
  const portalUrl = (process.env.NEXT_PUBLIC_PORTAL_URL || "https://matrix.acoblighting.com").replace(/\/$/, "")
  const activationUrl = `${portalUrl}/auth/setup-account?token=${encodeURIComponent(setupToken)}`

  const { error: tokenError } = await dataClient
    .from("profiles")
    .update({
      setup_token: setupTokenHash,
      setup_token_expires_at: setupTokenExpiresAt,
      must_reset_password: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (tokenError) {
    log.error({ err: tokenError, profileId: id }, "Failed to issue account activation token")
    return { ok: false, status: 500, error: "Could not prepare the Matrix activation link" }
  }

  const emailHtml = renderWelcomeEmail({
    pendingUser: {
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      department: profile.department || "General",
      designation: profile.designation || "Staff",
      company_email: profile.company_email,
      personal_email: profile.personal_email,
      employee_number: profile.employee_number || undefined,
      office_location: profile.office_location || undefined,
      residential_address: profile.residential_address || undefined,
      phone_number: profile.phone_number || undefined,
    },
    tempPassword: mailboxPassword,
    activationUrl,
    preparedBy,
  })

  const sendResult = await sendNotificationEmailWithRetry({
    // The company is the speaker of the welcome letter, whichever route sends it.
    from: ORG_EMAIL_SENDERS.company,
    ...ORG_MAIL_ROUTING.Onboarding,
    to: [profile.personal_email],
    subject: "Welcome to ACOB - Official Company Email & Matrix Setup",
    html: emailHtml,
  })

  if (!sendResult.sent) {
    await dataClient
      .from("profiles")
      .update({ setup_token: null, setup_token_expires_at: null, must_reset_password: false })
      .eq("id", id)
      .eq("setup_token", setupTokenHash)
    log.error({ reason: sendResult.reason, recipient: profile.personal_email }, "Failed to send credentials email")
    return { ok: false, status: 502, error: `Failed to deliver email: ${sendResult.reason}` }
  }

  const dispatchedAt = new Date().toISOString()
  const warnings: string[] = []
  const firstDispatch = !profile.mailbox_credentials_sent_at

  if (firstDispatch) {
    try {
      const recipients = await resolveOnboardedNoticeRecipients(dataClient, profile.department)
      const name = `${profile.first_name || ""} ${profile.last_name || ""}`.replace(/[\r\n]/g, "").trim()
      const result = await sendNotificationEmailsIndividuallyWithRetry({
        ...ORG_MAIL_ROUTING.Onboarding,
        to: recipients,
        subject: withSubjectPrefix("Onboarding", `New Employee Onboarded - ${name}`),
        html: renderInternalNotificationEmail({
          pendingUser: {
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            department: profile.department || "General",
            designation: profile.designation || "Staff",
            company_email: profile.company_email,
            personal_email: profile.personal_email,
            office_location: profile.office_location || undefined,
            phone_number: profile.phone_number || undefined,
          },
          preparedBy,
        }),
      })
      if (!result.sent) {
        const summary = result.failedRecipients.map((f) => `${f.recipient}: ${f.reason}`).join("; ")
        warnings.push(`Onboarded notice: ${summary || "not delivered"}`)
        log.error({ failedRecipients: result.failedRecipients }, "Onboarded notice failed for some recipients")
      }
    } catch (noticeError) {
      warnings.push(`Onboarded notice: ${noticeError instanceof Error ? noticeError.message : String(noticeError)}`)
      log.error({ err: noticeError, profileId: id }, "Failed to send onboarded notice")
    }
  }

  const { error: updateErr } = await dataClient
    .from("profiles")
    .update({ mailbox_credentials_sent_at: dispatchedAt, updated_at: dispatchedAt })
    .eq("id", id)
  if (updateErr) log.error({ err: updateErr, profileId: id }, "Failed to update mailbox_credentials_sent_at")

  const { error: notifyErr } = await dataClient.from("notifications").insert({
    user_id: id,
    type: "announcement",
    category: "system",
    priority: "high",
    title: "Welcome to ACOB",
    message: "Your official company email credentials and portal setup instructions have been dispatched.",
    link_url: null,
  })
  if (notifyErr) log.error({ err: notifyErr, profileId: id }, "Failed to create welcome notification")

  return { ok: true, dispatchedAt, recipient: profile.personal_email, firstDispatch, warnings }
}
