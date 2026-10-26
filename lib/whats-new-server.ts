import type { SupabaseClient } from "@supabase/supabase-js"
import { activeAnnouncements } from "@/lib/whats-new"
import { logger } from "@/lib/logger"

const log = logger("whats-new-server")

/**
 * Which active announcements this person has already dismissed. Reads with the
 * caller's own client — the select policy limits it to their rows. Returns null
 * when the read fails, so the popup stays shut instead of repeating each load.
 */
export async function loadWhatsNewSeen(client: SupabaseClient, userId: string): Promise<string[] | null> {
  const active = activeAnnouncements().map((a) => a.id)
  if (active.length === 0) return []

  const { data, error } = await client
    .from("whats_new_seen")
    .select("announcement_id")
    .eq("user_id", userId)
    .in("announcement_id", active)
  if (error) {
    log.error({ err: error.message }, "failed to load seen announcements")
    return null
  }
  return (data || []).map((row) => row.announcement_id as string)
}
