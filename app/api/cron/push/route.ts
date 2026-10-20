import { NextRequest, NextResponse } from "next/server"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { createClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { sendPushToUsers, isPushConfigured } from "@/lib/push/server"
import { isNotificationKey, type NotificationKey } from "@/lib/notifications/delivery-policy"
import { notificationTier } from "@/lib/notifications/tiers"

const log = logger("cron-push")

/** Most notifications the run will claim. One broadcast is ~51 rows. */
const BATCH_LIMIT = 200

/**
 * A notification older than this is claimed but not sent. If the app was down
 * for hours, waking people with a burst of stale alerts is worse than staying
 * quiet — the in-app bell and email already carry the backlog.
 */
const MAX_PUSH_AGE_MINUTES = 15

interface ClaimedNotification {
  id: string
  user_id: string | null
  category: string | null
  /** Absent until migration 20261003100000 is applied; treated as "push". */
  type?: string | null
  title: string | null
  message: string | null
  link_url: string | null
  priority: string | null
  created_at: string
}

/**
 * notifications.category and the delivery-policy keys share a vocabulary
 * (approvals and tasks were added for this), so real categories match
 * directly. "system" catches anything unrecognised, which is safe only because
 * push_mandatory is false there — the user can still mute it.
 */
function toNotificationKey(category: string | null): NotificationKey {
  const value = (category || "").trim().toLowerCase()
  return isNotificationKey(value) ? value : "system"
}

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isPushConfigured()) {
    // Claiming rows we cannot send would silently discard them.
    return NextResponse.json({ ok: true, skipped: "vapid_not_configured" })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 })
  }

  // Service role: push_subscriptions is RLS-scoped to each owner, and this run
  // sends on behalf of everyone.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { data, error } = await supabase.rpc("claim_notifications_for_push", { p_limit: BATCH_LIMIT })

    if (error) {
      log.error({ err: error.message }, "push cron: claim failed")
      return NextResponse.json({ error: "Claim failed." }, { status: 500 })
    }

    const claimed = (data || []) as ClaimedNotification[]
    if (!claimed.length) {
      return NextResponse.json({ ok: true, claimed: 0, sent: 0 })
    }

    const cutoff = Date.now() - MAX_PUSH_AGE_MINUTES * 60_000
    // Push is for work waiting on someone (audit 2.1 tiers). Updates stay in the
    // bell and announcements on the notifications page — pushing all 1,500 a
    // month trained people to ignore the ones that matter.
    const pushWorthy = (row: ClaimedNotification) =>
      row.type === undefined || notificationTier({ type: row.type, priority: row.priority }) === "action"
    const fresh = claimed.filter(
      (row) => Boolean(row.user_id && row.title) && Date.parse(row.created_at) >= cutoff && pushWorthy(row)
    )
    const stale = claimed.length - fresh.length

    let sent = 0
    let failed = 0
    let pruned = 0

    // Sequential on purpose: a broadcast claims ~51 rows, and firing them all
    // at once would open 51 concurrent connections to the push services from a
    // single serverless invocation.
    for (const row of fresh) {
      const result = await sendPushToUsers(supabase, {
        userIds: [row.user_id as string],
        notificationKey: toNotificationKey(row.category),
        payload: {
          title: row.title as string,
          body: row.message || "",
          url: row.link_url || "/",
          tag: row.id,
          priority: (row.priority as "low" | "normal" | "high" | "urgent") || "normal",
          notificationId: row.id,
        },
      })
      sent += result.sent
      failed += result.failed
      pruned += result.pruned
    }

    log.info({ claimed: claimed.length, stale, sent, failed, pruned }, "push cron run complete")

    return NextResponse.json({ ok: true, claimed: claimed.length, stale, sent, failed, pruned })
  } catch (error: unknown) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "push cron failed")
    return NextResponse.json({ error: "Push run failed." }, { status: 500 })
  }
}
