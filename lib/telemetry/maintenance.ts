import { z } from "zod"
import { telemetryClient } from "./server"

/** Alerts are opt-in, sent only to developers who subscribed in Error Monitor. */
export async function maintainErrorMonitor() {
  const client = telemetryClient()
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const { error: retentionError } = await client
    .from("audit_logs")
    .delete()
    .eq("action", "system_error")
    .eq("entity_type", "system_runtime")
    .lt("created_at", cutoff)
  if (retentionError) throw new Error("Unable to apply telemetry retention")
  const { data: settings, error } = await client
    .from("system_settings")
    .select("key, value")
    .like("key", "error_monitor_alert_%")
  if (error) throw new Error("Unable to load alert subscriptions")
  const now = new Date().toISOString()
  for (const setting of settings || []) {
    const subscription = z.object({ enabled: z.literal(true), since: z.string().datetime() }).safeParse(setting.value)
    if (!subscription.success) continue
    const userId = setting.key.slice("error_monitor_alert_".length)
    if (!z.string().uuid().safeParse(userId).success) continue
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
    if (profileError) throw new Error("Unable to verify alert subscriber")
    if (profile?.role !== "developer") continue
    const { count, error: countError } = await client
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "system_error")
      .eq("entity_type", "system_runtime")
      .eq("metadata->>resolved", "false")
      .gt("created_at", subscription.data.since)
      .lte("created_at", now)
    if (countError) throw new Error("Unable to count new failures")
    if (count) {
      const { error: notificationError } = await client.rpc("create_notification", {
        p_user_id: userId,
        p_type: "system",
        p_category: "system",
        p_title: "New system failures",
        p_message: `${count} new unresolved error${count === 1 ? "" : "s"} recorded. Open Error Monitor to investigate.`,
        p_priority: "high",
        p_link_url: "/admin/dev/ui-errors",
        p_entity_type: "system_runtime",
      })
      if (notificationError) throw new Error("Unable to send error alert")
    }
    const { error: checkpointError } = await client
      .from("system_settings")
      .update({
        value: { enabled: true, since: now },
        updated_at: now,
      })
      .eq("key", setting.key)
    if (checkpointError) throw new Error("Unable to save alert checkpoint")
  }
}
