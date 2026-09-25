import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export const NOTIFICATION_KEYS = [
  "onboarding",
  "help_desk",
  "leave",
  "assets",
  "meetings",
  "communications",
  "reports",
  "system",
  // Present in notifications.category from the start but never modelled here,
  // so they had no delivery policy of their own until push needed one.
  "approvals",
  "tasks",
  // Mail that sent outside any policy until 20 Sep 2026. The admin page claims
  // to govern notifications system-wide, so a stream with no key here was one
  // it silently could not switch off.
  "payroll",
  "attendance",
  "birthdays",
  "correspondence",
  "payments",
] as const

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number]
export type NotificationChannel = "in_app" | "email" | "push"

/**
 * Channels map 1:1 onto `<channel>_enabled` / `<channel>_mandatory` columns in
 * notification_delivery_policies, notification_preferences and
 * notification_user_delivery_preferences. Deriving the column name keeps a new
 * channel from needing a new branch in every check below.
 */
const enabledColumn = (channel: NotificationChannel) => `${channel}_enabled` as const
const mandatoryColumn = (channel: NotificationChannel) => `${channel}_mandatory` as const

const CHANNEL_ENABLED_COLUMNS = "in_app_enabled, email_enabled, push_enabled"
const CHANNEL_MANDATORY_COLUMNS = "in_app_mandatory, email_mandatory, push_mandatory"

type ChannelFlags = Record<string, boolean | null | undefined>

/** Absent or null means "no preference recorded", which the gate treats as allowed. */
function allows(flags: ChannelFlags | undefined, channel: NotificationChannel): boolean {
  return flags?.[enabledColumn(channel)] !== false
}

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
  supabaseClient: SupabaseClient<Database>,
  notificationKey: NotificationKey,
  channel: NotificationChannel
): Promise<boolean> {
  const supabase = getServiceRoleClientOrNull() || supabaseClient

  const { data: policy } = await supabase
    .from("notification_delivery_policies")
    .select(CHANNEL_ENABLED_COLUMNS)
    .eq("notification_key", notificationKey)
    .maybeSingle()

  if (!policy) return true
  return allows(policy as ChannelFlags, channel)
}

export async function isSystemNotificationChannelMandatory(
  supabaseClient: SupabaseClient<Database>,
  notificationKey: NotificationKey,
  channel: NotificationChannel
): Promise<boolean> {
  const supabase = getServiceRoleClientOrNull() || supabaseClient

  const { data: policy } = await supabase
    .from("notification_delivery_policies")
    .select(CHANNEL_MANDATORY_COLUMNS)
    .eq("notification_key", notificationKey)
    .maybeSingle()

  if (!policy) return false
  return (policy as ChannelFlags)[mandatoryColumn(channel)] === true
}

export async function resolveChannelEligibleUserIds(
  supabaseClient: SupabaseClient<Database>,
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
      .select(CHANNEL_MANDATORY_COLUMNS)
      .eq("notification_key", params.notificationKey)
      .maybeSingle(),
    supabase
      .from("notification_preferences")
      .select(`user_id, ${CHANNEL_ENABLED_COLUMNS}`)
      .in("user_id", uniqueUserIds),
    supabase
      .from("notification_user_delivery_preferences")
      .select(`user_id, ${CHANNEL_ENABLED_COLUMNS}`)
      .eq("notification_key", params.notificationKey)
      .in("user_id", uniqueUserIds),
  ])

  const isMandatory = (policyRes.data as ChannelFlags | null)?.[mandatoryColumn(params.channel)] === true

  const toPrefMap = (rows: unknown) =>
    new Map<string, ChannelFlags>(
      ((rows || []) as Array<ChannelFlags & { user_id: string }>).map((row) => [row.user_id, row])
    )

  const globalPrefMap = toPrefMap(globalPrefsRes.data)
  const modulePrefMap = toPrefMap(modulePrefsRes.data)

  return uniqueUserIds.filter((userId) => {
    if (isMandatory) {
      return true
    }

    // Both the global and the per-module preference must allow the channel.
    return allows(globalPrefMap.get(userId), params.channel) && allows(modulePrefMap.get(userId), params.channel)
  })
}
