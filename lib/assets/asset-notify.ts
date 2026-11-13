import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notifications/create"
import { logger } from "@/lib/logger"

const log = logger("assets-notify")

/**
 * The people who look after the asset register: admins granted the assets admin area. Super admins
 * and developers can open the page too, but are not paged for every report; the register's owners
 * are.
 */
export async function loadAssetAdminIds(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("employment_status", "active")
    .contains("admin_routes", ["assets.main"])
  if (error) {
    log.error({ err: String(error) }, "Could not load asset admins")
    return []
  }
  return ((data ?? []) as { id: string }[]).map((row) => row.id)
}

interface AssetNotification {
  type: "asset_assigned" | "asset_status_alert" | "asset_status_fixed"
  title: string
  message: string
  linkUrl: string
  actorId?: string | null
  entityType: string
  entityId: string
  priority?: "normal" | "high"
}

/** In-app notifications to each recipient. Never throws: a failed notification must not undo the action. */
export async function notifyAssetUsers(recipientIds: string[], notification: AssetNotification): Promise<number> {
  let sent = 0
  for (const userId of new Set(recipientIds)) {
    try {
      const { error } = await createNotification({
        p_user_id: userId,
        p_type: notification.type,
        p_category: "assets",
        p_title: notification.title,
        p_message: notification.message,
        p_priority: notification.priority ?? "normal",
        p_link_url: notification.linkUrl,
        p_actor_id: notification.actorId ?? null,
        p_entity_type: notification.entityType,
        p_entity_id: notification.entityId,
      })
      if (error) log.error({ err: String(error.message ?? error), userId }, "Asset notification failed")
      else sent += 1
    } catch (err) {
      log.error({ err: String(err), userId }, "Asset notification failed")
    }
  }
  return sent
}
