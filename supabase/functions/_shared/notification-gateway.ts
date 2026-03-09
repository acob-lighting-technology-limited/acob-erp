import { Resend } from "npm:resend@2.0.0"

export const DEFAULT_NOTIFICATION_SENDER = "ACOB Internal Systems <notifications@acoblighting.com>"

export type NotificationModule =
  | "Onboarding"
  | "Help Desk"
  | "Leave"
  | "Assets"
  | "Meetings"
  | "Communications"
  | "Reports"

export type NotificationKey =
  | "onboarding"
  | "help_desk"
  | "leave"
  | "assets"
  | "meetings"
  | "communications"
  | "reports"
  | "system"

interface SendEdgeNotificationEmailInput {
  resend: Resend
  to: Array<string | null | undefined>
  subject: string
  html: string
  moduleName: NotificationModule
  from?: string
}

export function normalizeRecipientEmails(emails: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) => (email || "").trim().toLowerCase())
        .filter((email) => email.length > 0 && email.includes("@"))
    )
  )
}

export function withSubjectPrefix(moduleName: NotificationModule, subject: string): string {
  const trimmed = String(subject || "").trim() || "Notification"
  const bracketPrefix = `[${moduleName}]`
  const colonPrefix = `${moduleName}:`

  if (trimmed.startsWith(colonPrefix)) return trimmed
  if (trimmed.startsWith(bracketPrefix)) {
    const rest = trimmed.slice(bracketPrefix.length).trim()
    return `${colonPrefix} ${rest || "Notification"}`
  }
  return `${colonPrefix} ${trimmed}`
}

export async function sendEdgeNotificationEmail(input: SendEdgeNotificationEmailInput) {
  const recipients = normalizeRecipientEmails(input.to)
  if (!recipients.length) return { sent: false as const, reason: "no_recipients" as const }

  const { error } = await input.resend.emails.send({
    from: input.from || DEFAULT_NOTIFICATION_SENDER,
    to: recipients,
    subject: withSubjectPrefix(input.moduleName, input.subject),
    html: input.html,
  })

  if (error) throw new Error(error.message || "Failed to send email")

  return { sent: true as const, recipients }
}

type EdgeSupabaseClient = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => any
      maybeSingle: () => Promise<{ data: any; error: unknown }>
    }
  }
}

export async function isEdgeSystemEmailEnabled(
  supabase: EdgeSupabaseClient,
  notificationKey: NotificationKey
): Promise<boolean> {
  const { data: policy } = await supabase
    .from("notification_delivery_policies")
    .select("email_enabled")
    .eq("notification_key", notificationKey)
    .maybeSingle()

  if (!policy) return true
  return policy.email_enabled !== false
}

export async function isEdgeSystemEmailMandatory(
  supabase: EdgeSupabaseClient,
  notificationKey: NotificationKey
): Promise<boolean> {
  const { data: policy } = await supabase
    .from("notification_delivery_policies")
    .select("email_mandatory")
    .eq("notification_key", notificationKey)
    .maybeSingle()

  if (!policy) return false
  return policy.email_mandatory === true
}

export async function canEdgeUserReceiveEmail(
  supabase: EdgeSupabaseClient,
  userId: string,
  notificationKey: NotificationKey
): Promise<boolean> {
  const [systemEnabled, systemMandatory] = await Promise.all([
    isEdgeSystemEmailEnabled(supabase, notificationKey),
    isEdgeSystemEmailMandatory(supabase, notificationKey),
  ])
  if (!systemEnabled) return false
  if (systemMandatory) return true

  const [{ data: globalPref }, { data: userPref }] = await Promise.all([
    supabase.from("notification_preferences").select("email_enabled").eq("user_id", userId).maybeSingle(),
    supabase
      .from("notification_user_delivery_preferences")
      .select("email_enabled")
      .eq("user_id", userId)
      .eq("notification_key", notificationKey)
      .maybeSingle(),
  ])

  const globalEnabled = globalPref?.email_enabled !== false
  const moduleEnabled = userPref?.email_enabled !== false

  return globalEnabled && moduleEnabled
}
