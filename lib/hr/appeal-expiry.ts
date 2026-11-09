import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { toLocalISODate } from "@/lib/utils/date"
import { createNotification } from "@/lib/notifications/create"
import { loadDepartmentLeads } from "@/lib/hr/attendance-appeals"

const log = logger("appeal-expiry")

/**
 * How long an undecided appeal stays open: to the end of the month after the appealed
 * day (an appeal for 10 Nov expires on 31 Dec), so every appeal is settled before the
 * attendance extraction of the month after. Out-of-station appeals reach back six
 * months when filed, so they keep six months after the month of the day.
 */
export function appealExpiryDate(appealDate: string, requestedStatus: string): string {
  const [year, month] = appealDate.split("-").map(Number)
  const monthsAfter = requestedStatus === "out_of_station" ? 6 : 1
  // Day 0 of the following month is the last day of the target month.
  const lastDay = new Date(Date.UTC(year, month - 1 + monthsAfter + 1, 0))
  const y = lastDay.getUTCFullYear()
  const m = String(lastDay.getUTCMonth() + 1).padStart(2, "0")
  const d = String(lastDay.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** True once `today` (YYYY-MM-DD, WAT) is past the appeal's expiry date. */
export function isAppealExpired(appealDate: string, requestedStatus: string, today: string): boolean {
  return today > appealExpiryDate(appealDate, requestedStatus)
}

/** Days from the grace start the backlog is given before anything expires. */
export const EXPIRY_BACKLOG_GRACE_DAYS = 7

export const EXPIRY_STATE_KEY = "attendance_appeal_expiry_state"

type PendingRow = {
  id: string
  user_id: string
  appeal_date: string
  requested_status: string
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`
}

/**
 * Expires pending appeals past their deadline. The first run does NOT expire anything:
 * it records the start date, tells the Admin & HR Lead which appeals are already past
 * their deadline, and gives the backlog EXPIRY_BACKLOG_GRACE_DAYS before they expire.
 * An expired appeal is not a rejection: the day stays as recorded and the employee is
 * told in the next decision summary email.
 */
export async function runAppealExpiry(
  client: SupabaseClient,
  now: Date = new Date()
): Promise<{ expired: number; overdue: number; skipped?: string }> {
  const today = toLocalISODate(now)

  const { data: setting, error: settingError } = await client
    .from("system_settings")
    .select("value")
    .eq("key", EXPIRY_STATE_KEY)
    .maybeSingle<{ value: { startedOn?: string } | null }>()
  if (settingError) throw new Error(`Failed to read ${EXPIRY_STATE_KEY}: ${settingError.message}`)

  const { data: pending, error } = await client
    .from("attendance_appeals")
    .select("id, user_id, appeal_date, requested_status")
    .eq("status", "pending")
    .returns<PendingRow[]>()
  if (error) throw new Error(`Failed to load pending appeals: ${error.message}`)

  const overdue = (pending ?? []).filter((row) => isAppealExpired(row.appeal_date, row.requested_status, today))

  const startedOn = setting?.value?.startedOn
  if (!startedOn) {
    // First run: record the start, list the backlog for the Admin & HR Lead, expire nothing.
    const { error: writeError } = await client.from("system_settings").upsert(
      {
        key: EXPIRY_STATE_KEY,
        value: { startedOn: today },
        description: "When appeal expiry started. Appeals already overdue then get one week before they expire.",
      },
      { onConflict: "key" }
    )
    if (writeError) throw new Error(`Failed to record ${EXPIRY_STATE_KEY}: ${writeError.message}`)
    await notifyBacklog(client, overdue, addDays(today, EXPIRY_BACKLOG_GRACE_DAYS))
    return { expired: 0, overdue: overdue.length, skipped: "grace_started" }
  }

  if (today <= addDays(startedOn, EXPIRY_BACKLOG_GRACE_DAYS)) {
    return { expired: 0, overdue: overdue.length, skipped: "in_grace" }
  }
  if (overdue.length === 0) return { expired: 0, overdue: 0 }

  let expired = 0
  for (const row of overdue) {
    const deadline = appealExpiryDate(row.appeal_date, row.requested_status)
    const nowIso = now.toISOString()
    const { error: updateError, count } = await client
      .from("attendance_appeals")
      .update(
        {
          status: "expired",
          stage: "expired",
          reviewed_at: nowIso,
          updated_at: nowIso,
          decision_emailed_at: null,
          resolution_note: `Expired: not decided by ${deadline}. The day stays as recorded.`,
        },
        { count: "exact" }
      )
      .eq("id", row.id)
      .eq("status", "pending")
    if (updateError) {
      log.error({ err: updateError.message, appealId: row.id }, "Failed to expire appeal")
      continue
    }
    expired += count ?? 0
  }
  return { expired, overdue: overdue.length }
}

async function notifyBacklog(client: SupabaseClient, overdue: PendingRow[], expiresFrom: string) {
  if (overdue.length === 0) return
  try {
    const leads = await loadDepartmentLeads(client)
    const ids = [...new Set(overdue.map((row) => row.user_id))]
    const { data: people } = await client
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", ids)
      .returns<Array<{ id: string; full_name: string | null; first_name: string | null; last_name: string | null }>>()
    const nameOf = new Map(
      (people ?? []).map((p) => [
        p.id,
        p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
      ])
    )
    const perPerson = new Map<string, number>()
    for (const row of overdue) perPerson.set(row.user_id, (perPerson.get(row.user_id) ?? 0) + 1)
    const list = [...perPerson.entries()].map(([id, count]) => `${nameOf.get(id) ?? "Unknown"} (${count})`).join(", ")

    for (const recipientId of new Set(leads.adminHrLeadIds)) {
      await createNotification({
        p_user_id: recipientId,
        p_type: "system",
        p_category: "approvals",
        p_title: "Attendance appeals past their deadline",
        p_message: `${overdue.length} pending appeal day(s) are past their deadline and will expire after ${expiresFrom} unless decided: ${list}.`,
        p_priority: "high",
        p_link_url: "/admin/hr/attendance?tab=appeals",
        p_entity_type: "attendance_appeal",
      })
    }
  } catch (err) {
    log.error({ err: String(err) }, "Failed to notify the Admin & HR Lead of the expiry backlog")
  }
}
