import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { renderActionEmail } from "@/lib/email-templates/action-email"
import { logger } from "@/lib/logger"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { isSystemNotificationChannelEnabled, resolveChannelEligibleUserIds } from "@/lib/notifications/delivery-policy"
import { ORG_EMAIL_SENDERS, ORG_ICT_EMAIL, ORG_MAIL_ROUTING } from "@/lib/org-config"
import type { Database } from "@/types/database"
import { listMailboxes, type CpanelMailbox } from "./client"
import { MAILBOX_ALERT_PERCENT, MAILBOX_ALERT_RESET_PERCENT, formatBytes, formatQuota } from "./quota"

const log = logger("mailbox-quota-alerts")

const ADMIN_PATH = "/admin/settings/mailboxes?tab=attention"
const FOOTER_LABEL = "Matrix · Mailboxes"

interface OwnerRow {
  id: string
  first_name: string | null
  full_name: string | null
  department: string | null
  company_email: string | null
}

interface AlertRow {
  email: string
}

export interface MailboxQuotaAlertSummary {
  checked: number
  alerted: string[]
  rearmed: number
  skipped: "email_disabled" | null
}

function percentLabel(m: CpanelMailbox): string {
  return `${Math.round(m.usedPercent ?? 0)}%`
}

function details(m: CpanelMailbox): Array<[string, string]> {
  return [
    ["Mailbox", m.email],
    ["Used", `${formatBytes(m.usedBytes)} (${percentLabel(m)})`],
    ["Quota", formatQuota(m.quotaBytes)],
  ]
}

/**
 * Daily: every mailbox at or over 90% gets one alert — to ICT, and to the
 * mailbox itself so the owner can chase ICT if the first mail is missed. A
 * mailbox alerts once per crossing; it re-arms only after falling back under
 * 85% (a quota raise or a clean-out), so a mailbox hovering at 90% is not
 * mailed every day.
 */
export async function runMailboxQuotaAlerts(serviceClient: SupabaseClient): Promise<MailboxQuotaAlertSummary> {
  const db = serviceClient as unknown as SupabaseClient<Database>
  const mailboxes = await listMailboxes()

  const { data: alertRows, error: alertError } = await serviceClient.from("mailbox_quota_alerts").select("email")
  if (alertError) throw new Error(alertError.message)
  const alreadyAlerted = new Set(((alertRows ?? []) as AlertRow[]).map((r) => r.email))

  // Re-arm mailboxes that have dropped back under the reset line, or no longer exist.
  const byEmail = new Map(mailboxes.map((m) => [m.email, m]))
  const rearm = [...alreadyAlerted].filter((email) => {
    const m = byEmail.get(email)
    return !m || (m.usedPercent ?? 0) < MAILBOX_ALERT_RESET_PERCENT
  })
  if (rearm.length > 0) {
    const { error } = await serviceClient.from("mailbox_quota_alerts").delete().in("email", rearm)
    if (error) log.error({ err: error.message }, "Failed to re-arm mailbox alerts")
  }

  const due = mailboxes.filter((m) => (m.usedPercent ?? 0) >= MAILBOX_ALERT_PERCENT && !alreadyAlerted.has(m.email))
  const summary: MailboxQuotaAlertSummary = {
    checked: mailboxes.length,
    alerted: [],
    rearmed: rearm.length,
    skipped: null,
  }
  if (due.length === 0) return summary

  if (!(await isSystemNotificationChannelEnabled(db, "system", "email"))) {
    summary.skipped = "email_disabled"
    return summary
  }

  const { data: ownerRows } = await serviceClient
    .from("profiles")
    .select("id, first_name, full_name, department, company_email")
    .in(
      "company_email",
      due.map((m) => m.email)
    )
  const owners = new Map<string, OwnerRow>()
  for (const o of (ownerRows ?? []) as OwnerRow[]) {
    if (o.company_email) owners.set(o.company_email.trim().toLowerCase(), o)
  }
  const ownerIds = [...owners.values()].map((o) => o.id)
  const inAppEligible = await resolveChannelEligibleUserIds(db, {
    userIds: ownerIds,
    notificationKey: "system",
    channel: "in_app",
  })

  for (const m of due) {
    const owner = owners.get(m.email) ?? null
    const subject = `Mailbox Almost Full — ${m.email}`
    let sentAny = false

    // ICT: the people who can raise the quota.
    try {
      const result = await sendNotificationEmailWithRetry({
        from: ORG_EMAIL_SENDERS.system,
        ...ORG_MAIL_ROUTING.Mailboxes,
        to: [ORG_ICT_EMAIL],
        subject,
        html: renderActionEmail({
          recipientFirstName: "ICT",
          heading: "Mailbox almost full",
          intro: `${m.email}${owner ? ` (${owner.full_name ?? owner.first_name ?? "staff"})` : ""} is ${percentLabel(m)} full. Raise its quota before it fills up and starts rejecting new mail.`,
          detailsTitle: "Mailbox",
          details: owner?.department ? [...details(m), ["Department", owner.department]] : details(m),
          ctaLabel: "Open Mailboxes",
          ctaPath: ADMIN_PATH,
          footerLabel: FOOTER_LABEL,
        }),
      })
      if (result.sent) sentAny = true
      else log.error({ reason: result.reason, mailbox: m.email }, "ICT mailbox alert not sent")
    } catch (err) {
      log.error({ err: String(err), mailbox: m.email }, "ICT mailbox alert failed")
    }

    // The owner, at the company address itself (still accepting mail at 90%).
    // A suspended mailbox has nobody reading it.
    if (!m.suspendedLogin) {
      try {
        const result = await sendNotificationEmailWithRetry({
          from: ORG_EMAIL_SENDERS.system,
          ...ORG_MAIL_ROUTING.Mailboxes,
          to: [m.email],
          subject,
          html: renderActionEmail({
            recipientFirstName: owner?.first_name ?? "",
            heading: "Your mailbox is almost full",
            intro: `Your company mailbox is ${percentLabel(m)} full. When it is full, new mail sent to you will be rejected. ICT has been alerted to raise your quota — please let them know as well, in case they missed it.`,
            detailsTitle: "Your mailbox",
            details: details(m),
            ctaLabel: "View my profile",
            ctaPath: "/profile",
            footerLabel: FOOTER_LABEL,
          }),
        })
        if (result.sent) sentAny = true
        else log.error({ reason: result.reason, mailbox: m.email }, "Owner mailbox alert not sent")
      } catch (err) {
        log.error({ err: String(err), mailbox: m.email }, "Owner mailbox alert failed")
      }
    }

    if (owner && !m.suspendedLogin && inAppEligible.includes(owner.id)) {
      try {
        await serviceClient.rpc("create_notification", {
          p_user_id: owner.id,
          p_type: "system",
          p_category: "system",
          p_title: "Your mailbox is almost full",
          p_message: `${m.email} is ${percentLabel(m)} full (${formatBytes(m.usedBytes)} of ${formatQuota(m.quotaBytes)}). ICT has been alerted — let them know too so they can raise your quota.`,
          p_priority: "high",
          p_link_url: "/profile",
          p_entity_type: "mailbox",
          p_entity_id: m.email,
        })
      } catch (err) {
        log.error({ err: String(err), mailbox: m.email }, "Mailbox in-app alert failed")
      }
    }

    // Only remember the alert once something actually went out; otherwise retry tomorrow.
    if (sentAny) {
      const { error } = await serviceClient
        .from("mailbox_quota_alerts")
        .upsert({ email: m.email, used_percent: m.usedPercent, alerted_at: new Date().toISOString() })
      if (error) log.error({ err: error.message, mailbox: m.email }, "Failed to record mailbox alert")
      summary.alerted.push(m.email)
    }
  }

  return summary
}
