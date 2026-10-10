import type { SupabaseClient } from "@supabase/supabase-js"
import { escapeHtml } from "@/lib/email-templates/utils"
import { logger } from "@/lib/logger"
import { sendNotificationEmailsIndividuallyWithRetry } from "@/lib/notifications/email-gateway"
import { resolveChannelEligibleUserIds } from "@/lib/notifications/delivery-policy"
import { ORG_EMAIL_SENDERS, ORG_MAIL_ROUTING } from "@/lib/org-config"
import { toLocalISODate, toLocalTimeString } from "@/lib/utils/date"
import type { Database } from "@/types/database"

const log = logger("starlink-billing-alerts")

export const STARLINK_ALERTS_SETTINGS_KEY = "starlink_billing_alerts"

export type StarlinkAlertRule = { enabled: boolean; recipientUserIds: string[] }

/** Who is told about Starlink billing, edited from Accounts > Starlink Kits > Alerts. */
export type StarlinkAlertsConfig = {
  /** A kit's payment failed (first failure of a billing month). */
  failed: StarlinkAlertRule
  /** A kit's bill is coming due, `daysBefore` days ahead. */
  due: StarlinkAlertRule & { daysBefore: number }
}

export const DEFAULT_STARLINK_ALERTS: StarlinkAlertsConfig = {
  failed: { enabled: false, recipientUserIds: [] },
  due: { enabled: false, recipientUserIds: [], daysBefore: 3 },
}

/** Due reminders go out in working hours only; the sync runs round the clock. */
const DUE_ALERT_HOURS_WAT = { from: 8, to: 18 }

export function normalizeAlertsConfig(value: unknown): StarlinkAlertsConfig {
  const v = (value ?? {}) as Partial<StarlinkAlertsConfig>
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((id): id is string => typeof id === "string") : [])
  const days = Number(v.due?.daysBefore)
  return {
    failed: { enabled: Boolean(v.failed?.enabled), recipientUserIds: ids(v.failed?.recipientUserIds) },
    due: {
      enabled: Boolean(v.due?.enabled),
      recipientUserIds: ids(v.due?.recipientUserIds),
      daysBefore: Number.isInteger(days) && days >= 0 && days <= 14 ? days : DEFAULT_STARLINK_ALERTS.due.daysBefore,
    },
  }
}

export async function loadAlertsConfig(supabase: SupabaseClient): Promise<StarlinkAlertsConfig> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", STARLINK_ALERTS_SETTINGS_KEY)
    .maybeSingle()
  return normalizeAlertsConfig(data?.value)
}

type Recipient = { id: string; name: string; emails: string[] }

async function resolveRecipients(supabase: SupabaseClient, userIds: string[]): Promise<Recipient[]> {
  if (userIds.length === 0) return []
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name, company_email, additional_email")
    .in("id", userIds)
  return (
    (data || []) as Array<{
      id: string
      full_name: string | null
      first_name: string | null
      last_name: string | null
      company_email: string | null
      additional_email: string | null
    }>
  ).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Team Member",
    emails: [p.company_email, p.additional_email].filter((e): e is string => Boolean(e && e.trim())),
  }))
}

function formatNaira(amount: number | null): string {
  return amount == null ? "-" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount)
}

function formatDay(iso: string | null): string {
  if (!iso) return "-"
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Branded ACOB shell (dark-mode-locked header/footer) around a short alert. */
export function renderStarlinkAlertEmail(params: {
  recipientName: string
  heading: string
  intro: string
  rows: Array<[string, string]>
  actionUrl: string
}): string {
  const bar =
    "background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;"
  const rows = params.rows
    .map(
      ([label, value], i) => `
                <tr>
                    <td style="width: 38%; color: #64748b; font-weight: 500; border-right: 1px solid #e5e7eb; padding: 12px 18px; font-size: 13px;${i < params.rows.length - 1 ? " border-bottom: 1px solid #e5e7eb;" : ""}">${escapeHtml(label)}</td>
                    <td style="color: #0f172a; font-weight: 600; padding: 12px 18px; font-size: 13px;${i < params.rows.length - 1 ? " border-bottom: 1px solid #e5e7eb;" : ""}">${escapeHtml(value)}</td>
                </tr>`
    )
    .join("")
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(params.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#fff;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; overflow: hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="${bar}border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;">
        <tr><td align="center" style="padding:20px 0;${bar}">
            <img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" alt="ACOB Lighting" height="65">
        </td></tr>
    </table>
    <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px;">
        <div style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px;">${escapeHtml(params.heading)}</div>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0;">Hello ${escapeHtml(params.recipientName)},</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0;">${escapeHtml(params.intro)}</p>
        <div style="margin-top: 22px; border: 1px solid #e5e7eb; overflow: hidden; background: #fbfbfb; border-radius: 6px;">
            <table style="width: 100%; border-collapse: collapse;">${rows}
            </table>
        </div>
        <p style="margin: 26px 0 0 0;">
            <a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:6px;">Open the payment</a>
        </p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="${bar}border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;">
        <tr><td align="center" style="padding:20px;${bar}font-size:11px;color:#d1d5db;">
            <span style="color:#d1d5db;">IT &amp; Communications</span><br>
            <strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>
            <span style="color:#16a34a; font-weight:600;">Matrix · Starlink Billing</span>
            <br><br>
            <i style="color:#9ca3af; font-style:italic;">This is an automated notification, but replies are read — reply to this email and it reaches the accounts team.</i>
        </td></tr>
    </table>
    </div>
</body>
</html>
  `
}

type Alert = {
  recipients: Recipient[]
  subject: string
  heading: string
  intro: string
  rows: Array<[string, string]>
  paymentId: string
  inAppTitle: string
  inAppMessage: string
  priority: "normal" | "high"
}

/** Email each recipient separately and add the matching in-app notification. */
async function deliver(supabase: SupabaseClient, alert: Alert, appUrl: string): Promise<number> {
  const db = supabase as unknown as SupabaseClient<Database>
  const ids = alert.recipients.map((r) => r.id)
  const [emailIds, inAppIds] = await Promise.all([
    resolveChannelEligibleUserIds(db, { userIds: ids, notificationKey: "payments", channel: "email" }),
    resolveChannelEligibleUserIds(db, { userIds: ids, notificationKey: "payments", channel: "in_app" }),
  ])
  const actionPath = `/admin/accounts/payments/${alert.paymentId}`
  let delivered = 0

  for (const recipient of alert.recipients) {
    if (emailIds.includes(recipient.id) && recipient.emails.length > 0) {
      try {
        const result = await sendNotificationEmailsIndividuallyWithRetry({
          from: ORG_EMAIL_SENDERS.system,
          ...ORG_MAIL_ROUTING.Payments,
          to: recipient.emails,
          subject: alert.subject,
          html: renderStarlinkAlertEmail({
            recipientName: recipient.name,
            heading: alert.heading,
            intro: alert.intro,
            rows: alert.rows,
            actionUrl: `${appUrl}${actionPath}`,
          }),
        })
        if (result.sent) delivered += 1
      } catch (err) {
        log.error({ err: String(err), recipient: recipient.id }, "Starlink alert email failed")
      }
    }
    if (inAppIds.includes(recipient.id)) {
      try {
        await supabase.rpc("create_notification", {
          p_user_id: recipient.id,
          p_type: "system",
          p_category: "system",
          p_title: alert.inAppTitle,
          p_message: alert.inAppMessage,
          p_priority: alert.priority,
          p_link_url: actionPath,
          p_entity_type: "department_payment",
          p_entity_id: alert.paymentId,
        })
      } catch (err) {
        log.error({ err: String(err), recipient: recipient.id }, "Starlink in-app alert failed")
      }
    }
  }
  return delivered
}

type FailedEventRow = {
  id: string
  site_id: string
  payment_id: string | null
  period_start: string | null
  amount: number | null
  received_at: string
}

type KitRow = {
  id: string
  site_name: string
  serial_number: string | null
  is_active: boolean
  due_alert_sent_for: string | null
  project: { project_name: string } | Array<{ project_name: string }> | null
}

function projectName(kit: KitRow): string {
  const p = Array.isArray(kit.project) ? kit.project[0] : kit.project
  return p?.project_name ?? "No project"
}

/** Today's date and hour in Lagos (WAT). */
function watNow(now: Date): { date: string; hour: number } {
  return { date: toLocalISODate(now), hour: Number(toLocalTimeString(now).slice(0, 2)) }
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86_400_000)
}

export type StarlinkAlertsSummary = { failedAlerts: number; dueAlerts: number }

/**
 * Send the configured Starlink alerts. Called after each hourly billing sync.
 * - Failed: one alert per kit and billing month, on its first failure.
 * - Due: one alert per bill, `daysBefore` days ahead (or later that day if the
 *   job missed it), in working hours.
 */
export async function sendStarlinkBillingAlerts(
  supabase: SupabaseClient,
  options: { appUrl: string; now?: Date }
): Promise<StarlinkAlertsSummary> {
  const config = await loadAlertsConfig(supabase)
  const summary: StarlinkAlertsSummary = { failedAlerts: 0, dueAlerts: 0 }
  const now = options.now ?? new Date()

  const { data: kitRows, error: kitError } = await supabase
    .from("starlink_sites")
    .select("id, site_name, serial_number, is_active, due_alert_sent_for, project:projects(project_name)")
  if (kitError) throw new Error(kitError.message)
  const kits = new Map(((kitRows || []) as KitRow[]).map((k) => [k.id, k]))

  // Failed -------------------------------------------------------------------
  const { data: failedRows, error: failedError } = await supabase
    .from("starlink_billing_events")
    .select("id, site_id, payment_id, period_start, amount, received_at")
    .eq("kind", "failed")
    .eq("outcome", "applied")
    .is("alerted_at", null)
    .not("site_id", "is", null)
    .order("received_at")
  if (failedError) throw new Error(failedError.message)

  const pending = (failedRows || []) as FailedEventRow[]
  if (pending.length > 0) {
    const recipients = config.failed.enabled ? await resolveRecipients(supabase, config.failed.recipientUserIds) : []
    // Months already alerted, so a later retry failing doesn't alert again.
    const { data: alertedRows } = await supabase
      .from("starlink_billing_events")
      .select("site_id, period_start")
      .eq("kind", "failed")
      .not("alerted_at", "is", null)
    const alerted = new Set(
      ((alertedRows || []) as Array<{ site_id: string; period_start: string | null }>).map(
        (r) => `${r.site_id}|${r.period_start}`
      )
    )

    for (const event of pending) {
      const key = `${event.site_id}|${event.period_start}`
      const kit = kits.get(event.site_id)
      if (config.failed.enabled && recipients.length > 0 && !alerted.has(key) && kit && event.payment_id) {
        await deliver(
          supabase,
          {
            recipients,
            subject: `Starlink Payment Failed — ${kit.site_name}`,
            heading: "Starlink Payment Failed",
            intro: `Starlink could not charge the card for the ${kit.site_name} kit. Starlink retries over the next few days; if the card is over its limit, top it up or pay from the Starlink account to avoid the service being paused.`,
            rows: [
              ["Kit", kit.site_name],
              ["Project", projectName(kit)],
              ["Starlink account", kit.serial_number ?? "-"],
              ["Bill for", formatDay(event.period_start)],
              ["Amount", formatNaira(event.amount != null ? Number(event.amount) : null)],
            ],
            paymentId: event.payment_id,
            inAppTitle: "Starlink Payment Failed",
            inAppMessage: `The ${kit.site_name} Starlink payment of ${formatNaira(event.amount != null ? Number(event.amount) : null)} failed.`,
            priority: "high",
          },
          options.appUrl
        )
        summary.failedAlerts += 1
      }
      alerted.add(key)
      // Marked even when alerts are off, so switching them on later doesn't replay history.
      await supabase.from("starlink_billing_events").update({ alerted_at: now.toISOString() }).eq("id", event.id)
    }
  }

  // Due ----------------------------------------------------------------------
  const { date: today, hour } = watNow(now)
  if (config.due.enabled && hour >= DUE_ALERT_HOURS_WAT.from && hour < DUE_ALERT_HOURS_WAT.to) {
    const recipients = await resolveRecipients(supabase, config.due.recipientUserIds)
    const { data: payments, error: paymentsError } = await supabase
      .from("department_payments")
      .select("id, site_id, amount, next_payment_due")
      .eq("category", "Starlink")
      .neq("status", "cancelled")
      .not("site_id", "is", null)
      .not("next_payment_due", "is", null)
    if (paymentsError) throw new Error(paymentsError.message)

    for (const payment of (payments || []) as Array<{
      id: string
      site_id: string
      amount: number
      next_payment_due: string
    }>) {
      const kit = kits.get(payment.site_id)
      const due = payment.next_payment_due.slice(0, 10)
      const daysLeft = daysBetween(today, due)
      if (!kit || !kit.is_active || recipients.length === 0) continue
      if (daysLeft < 0 || daysLeft > config.due.daysBefore || kit.due_alert_sent_for === due) continue

      const when = daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `in ${daysLeft} Days`
      await deliver(
        supabase,
        {
          recipients,
          subject: `Starlink Bill Due ${when} — ${kit.site_name}`,
          heading: `Starlink Bill Due ${when}`,
          intro: `The ${kit.site_name} Starlink bill is charged automatically on ${formatDay(due)}. Make sure the card has enough funds so the payment goes through first time.`,
          rows: [
            ["Kit", kit.site_name],
            ["Project", projectName(kit)],
            ["Starlink account", kit.serial_number ?? "-"],
            ["Due", formatDay(due)],
            ["Amount", formatNaira(Number(payment.amount))],
          ],
          paymentId: payment.id,
          inAppTitle: `Starlink Bill Due ${when}`,
          inAppMessage: `${kit.site_name} Starlink (${formatNaira(Number(payment.amount))}) is charged on ${formatDay(due)}.`,
          priority: "normal",
        },
        options.appUrl
      )
      await supabase.from("starlink_sites").update({ due_alert_sent_for: due }).eq("id", kit.id)
      summary.dueAlerts += 1
    }
  }

  if (summary.failedAlerts || summary.dueAlerts) log.info(summary, "Starlink billing alerts sent")
  return summary
}
