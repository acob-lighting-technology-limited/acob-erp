import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { EDIT_AREA_LABELS, type EditArea } from "@/lib/admin/policy-v2"
import { previousMonthWindow } from "@/lib/hr/self-approved"
import { createNotification } from "@/lib/notifications/create"

const log = logger("admin-override-report")

export interface OverrideChange {
  userId: string | null
  area: string
  action: string
  entityType: string
  createdAt: string
}

/**
 * Changes made as an override in a window (audit rows the middleware tagged `edit_mode: override`
 * and `edit_area`). Capped so a runaway month cannot blow up the notice.
 */
export async function loadOverrideChanges(
  client: SupabaseClient,
  window: { fromIso: string; toIso: string }
): Promise<OverrideChange[]> {
  const { data, error } = await client
    .from("audit_logs")
    .select("user_id, action, entity_type, created_at, metadata")
    .eq("metadata->>edit_mode", "override")
    .gte("created_at", window.fromIso)
    .lt("created_at", window.toIso)
    .order("created_at", { ascending: true })
    .limit(2000)
    .returns<
      Array<{
        user_id: string | null
        action: string | null
        entity_type: string | null
        created_at: string
        metadata: { edit_area?: string } | null
      }>
    >()
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((row) => row.metadata?.edit_area)
    .map((row) => ({
      userId: row.user_id,
      area: String(row.metadata?.edit_area),
      action: row.action ?? "change",
      entityType: row.entity_type ?? "record",
      createdAt: row.created_at,
    }))
}

/** "3 by Rafiat Egunjobi, 1 by Peter Ayoola" from a list of changes and a name lookup. */
export function summariseOverrideChanges(changes: OverrideChange[], names: Map<string, string>): string {
  const counts = new Map<string, number>()
  for (const change of changes) {
    const who = (change.userId && names.get(change.userId)) || "someone"
    counts.set(who, (counts.get(who) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([who, count]) => `${count} by ${who}`)
    .join(", ")
}

/**
 * On the 1st of each month: tells the owners of each guarded area, in-app, about every change made
 * there last month as an override. Sends nothing for a quiet month, and nothing for an area without
 * owners.
 */
export async function notifyOverridesMonthly(
  client: SupabaseClient,
  now: Date = new Date()
): Promise<{ changes: number; notified: number }> {
  const window = previousMonthWindow(now)
  const changes = await loadOverrideChanges(client, window)
  if (changes.length === 0) return { changes: 0, notified: 0 }

  const ids = Array.from(new Set(changes.map((change) => change.userId).filter(Boolean) as string[]))
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const { data: people } = await client
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", ids)
      .returns<Array<{ id: string; full_name: string | null; first_name: string | null; last_name: string | null }>>()
    for (const person of people ?? []) {
      names.set(
        person.id,
        person.full_name?.trim() || [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || "Unknown"
      )
    }
  }

  const byArea = new Map<string, OverrideChange[]>()
  for (const change of changes) byArea.set(change.area, [...(byArea.get(change.area) ?? []), change])

  let notified = 0
  for (const [area, list] of byArea) {
    const { data: owners } = await client
      .from("edit_area_owners")
      .select("user_id")
      .eq("area", area)
      .returns<Array<{ user_id: string }>>()
    const label = EDIT_AREA_LABELS[area as EditArea] ?? area
    for (const owner of owners ?? []) {
      const { error } = await createNotification({
        p_user_id: owner.user_id,
        p_type: "system",
        p_category: "approvals",
        p_title: `Override changes in ${label}: ${window.label}`,
        p_message: `${list.length} change(s) were made in ${label} as an override in ${window.label}: ${summariseOverrideChanges(list, names)}.`,
        p_priority: "normal",
        p_link_url: "/admin/audit-logs",
        p_entity_type: "edit_override",
      })
      if (error) log.error({ err: error.message, area }, "Could not send the monthly override notice")
      else notified += 1
    }
  }
  return { changes: changes.length, notified }
}
