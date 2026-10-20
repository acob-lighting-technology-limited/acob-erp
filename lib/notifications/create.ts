/**
 * Arguments of the `create_notification` RPC (the 11-argument version). Category
 * and type values are documented in AGENTS.md → Notification System.
 */
export interface CreateNotificationArgs {
  p_user_id: string
  p_type: string
  p_category: string
  p_title: string
  p_message: string
  p_priority?: "low" | "normal" | "high" | "urgent" | string
  p_link_url?: string | null
  p_actor_id?: string | null
  p_entity_type?: string | null
  p_entity_id?: string | null
  p_rich_content?: unknown
}

/**
 * Create an in-app notification. Server-only: `create_notification` is a
 * SECURITY DEFINER function that takes an arbitrary recipient and link, so it is
 * granted to service_role only and must never be reachable from the browser.
 *
 * Returns the same `{ data, error }` shape as `supabase.rpc(...)`, so callers can
 * keep their existing error handling. Never throws.
 *
 * The admin client is imported lazily: it carries the `server-only` guard (so a
 * client bundle that reaches this module still fails the build), but importing
 * this module in a unit test does not trip it unless a notification is sent.
 */
export async function createNotification(args: CreateNotificationArgs) {
  const { getServiceClient } = await import("@/lib/supabase/admin")
  const client = getServiceClient()
  if (!client) {
    return { data: null, error: { message: "Service role is not configured; notification not created" } }
  }
  return client.rpc("create_notification", args)
}
