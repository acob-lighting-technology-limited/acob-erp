import webpush from "web-push"
import { logger } from "@/lib/logger"
import { resolveChannelEligibleUserIds, type NotificationKey } from "@/lib/notifications/delivery-policy"
import type { SupabaseClient } from "@supabase/supabase-js"

const log = logger("lib-push-server")

export interface PushPayload {
  title: string
  body: string
  /** Where tapping the notification should land. */
  url?: string
  /** Collapse key — repeat pushes about one entity replace each other. */
  tag?: string
  priority?: "low" | "normal" | "high" | "urgent"
  notificationId?: string
}

interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

let configured = false

/**
 * VAPID identifies this server to Apple's and Google's push services. Both keys
 * must be present; without them we no-op rather than throw, so a missing env
 * var degrades push instead of breaking whatever action triggered it.
 */
function ensureConfigured(): boolean {
  if (configured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:it@acoblighting.com"

  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/**
 * Sends a push to every registered device of every eligible user.
 *
 * Requires a service-role client: push_subscriptions is RLS-scoped so a user
 * can only read their own rows, but sending must reach other people's devices.
 */
export async function sendPushToUsers(
  supabase: SupabaseClient,
  params: {
    userIds: string[]
    notificationKey: NotificationKey
    payload: PushPayload
  }
): Promise<{ sent: number; failed: number; pruned: number; skipped?: string }> {
  const empty = { sent: 0, failed: 0, pruned: 0 }

  if (!ensureConfigured()) {
    return { ...empty, skipped: "vapid_not_configured" }
  }

  // Push honours the same preference rules as in-app and email.
  const eligibleUserIds = await resolveChannelEligibleUserIds(supabase, {
    userIds: params.userIds,
    notificationKey: params.notificationKey,
    channel: "push",
  })
  if (!eligibleUserIds.length) return { ...empty, skipped: "no_eligible_users" }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", eligibleUserIds)

  if (error) {
    log.error({ err: error.message }, "push: failed to load subscriptions")
    return { ...empty, skipped: "subscription_lookup_failed" }
  }

  const rows = (subscriptions || []) as PushSubscriptionRow[]
  if (!rows.length) return { ...empty, skipped: "no_devices" }

  const body = JSON.stringify({
    title: params.payload.title,
    body: params.payload.body,
    url: params.payload.url || "/",
    tag: params.payload.tag,
    priority: params.payload.priority || "normal",
    notificationId: params.payload.notificationId || null,
    timestamp: Date.now(),
  })

  const staleIds: string[] = []
  let sent = 0
  let failed = 0

  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body, {
        TTL: 60 * 60 * 24,
      })
    )
  )

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1
      return
    }

    failed += 1
    const statusCode = (result.reason as { statusCode?: number })?.statusCode

    // 404/410 mean the push service has permanently dropped this subscription
    // (app deleted, or re-installed). Those rows are dead and must be removed,
    // or every later send retries a device that can never receive again.
    if (statusCode === 404 || statusCode === 410) {
      staleIds.push(rows[index].id)
    } else {
      log.warn({ statusCode, endpoint: rows[index].endpoint.slice(0, 60) }, "push: delivery failed")
    }
  })

  if (staleIds.length) {
    const { error: pruneError } = await supabase.from("push_subscriptions").delete().in("id", staleIds)
    if (pruneError) {
      log.error({ err: pruneError.message, count: staleIds.length }, "push: failed to prune stale subscriptions")
    }
  }

  if (sent > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in(
        "id",
        rows.filter((_, i) => results[i].status === "fulfilled").map((row) => row.id)
      )
  }

  return { sent, failed, pruned: staleIds.length }
}
