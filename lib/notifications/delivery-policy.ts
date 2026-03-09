import { createClient as createAdminClient } from "@supabase/supabase-js"

export const NOTIFICATION_KEYS = [
  "onboarding",
  "help_desk",
  "leave",
  "assets",
  "meetings",
  "communications",
  "reports",
  "system",
] as const

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number]
export type NotificationChannel = "in_app" | "email"

export function isNotificationKey(value: string): value is NotificationKey {
  return (NOTIFICATION_KEYS as readonly string[]).includes(value)
}

function getServiceRoleClientOrNull() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function isSystemNotificationChannelEnabled(
  supabaseClient: any,
  notificationKey: NotificationKey,
  channel: NotificationChannel
): Promise<boolean> {
  const supabase = getServiceRoleClientOrNull() || supabaseClient

  const { data: policy } = await supabase
    .from("notification_delivery_policies")
    .select("in_app_enabled, email_enabled")
    .eq("notification_key", notificationKey)
    .maybeSingle()

  if (!policy) return true
  return channel === "email" ? policy.email_enabled !== false : policy.in_app_enabled !== false
}

export async function isSystemNotificationChannelMandatory(
  supabaseClient: any,
  notificationKey: NotificationKey,
  channel: NotificationChannel
): Promise<boolean> {
  const supabase = getServiceRoleClientOrNull() || supabaseClient

  const { data: policy } = await supabase
    .from("notification_delivery_policies")
    .select("in_app_mandatory, email_mandatory")
    .eq("notification_key", notificationKey)
    .maybeSingle()

  if (!policy) return false
  return channel === "email" ? policy.email_mandatory === true : policy.in_app_mandatory === true
}

export async function resolveChannelEligibleUserIds(
  supabaseClient: any,
  params: {
    userIds: string[]
    notificationKey: NotificationKey
    channel: NotificationChannel
  }
): Promise<string[]> {
  const uniqueUserIds = Array.from(new Set(params.userIds.filter(Boolean)))
  if (!uniqueUserIds.length) return []

  const supabase = getServiceRoleClientOrNull() || supabaseClient

  const systemEnabled = await isSystemNotificationChannelEnabled(supabase, params.notificationKey, params.channel)
  if (!systemEnabled) return []

  const [policyRes, globalPrefsRes, modulePrefsRes] = await Promise.all([
    supabase
      .from("notification_delivery_policies")
      .select("in_app_mandatory, email_mandatory")
      .eq("notification_key", params.notificationKey)
      .maybeSingle(),
    supabase
      .from("notification_preferences")
      .select("user_id, in_app_enabled, email_enabled")
      .in("user_id", uniqueUserIds),
    supabase
      .from("notification_user_delivery_preferences")
      .select("user_id, in_app_enabled, email_enabled")
      .eq("notification_key", params.notificationKey)
      .in("user_id", uniqueUserIds),
  ])
  const isMandatory =
    params.channel === "email" ? policyRes.data?.email_mandatory === true : policyRes.data?.in_app_mandatory === true

  const globalPrefMap = new Map<string, { in_app_enabled: boolean; email_enabled: boolean }>(
    ((globalPrefsRes.data || []) as Array<{ user_id: string; in_app_enabled: boolean; email_enabled: boolean }>).map(
      (row) => [row.user_id, row]
    )
  )

  const modulePrefMap = new Map<string, { in_app_enabled: boolean | null; email_enabled: boolean | null }>(
    (
      (modulePrefsRes.data || []) as Array<{
        user_id: string
        in_app_enabled: boolean | null
        email_enabled: boolean | null
      }>
    ).map((row) => [row.user_id, row])
  )

  return uniqueUserIds.filter((userId) => {
    const globalPref = globalPrefMap.get(userId)
    const modulePref = modulePrefMap.get(userId)

    if (isMandatory) {
      return true
    }

    const globalAllowed =
      params.channel === "email" ? globalPref?.email_enabled !== false : globalPref?.in_app_enabled !== false
    const moduleAllowed =
      params.channel === "email"
        ? modulePref?.email_enabled === null ||
          modulePref?.email_enabled === undefined ||
          modulePref?.email_enabled === true
        : modulePref?.in_app_enabled === null ||
          modulePref?.in_app_enabled === undefined ||
          modulePref?.in_app_enabled === true

    return globalAllowed && moduleAllowed
  })
}
