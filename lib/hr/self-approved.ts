import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { DEPT_EXECUTIVE_MANAGEMENT } from "@/shared/departments"
import { createNotification } from "@/lib/notifications/create"
import { loadDepartmentLeads } from "@/lib/hr/attendance-appeals"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"

const log = logger("self-approved-appeals")

export type SelfApprovedAppeal = {
  id: string
  user_id: string
  user_name: string
  appeal_date: string
  requested_status: string
  appeal_reason: string | null
  reviewed_at: string
  /** The month it was approved, YYYY-MM (WAT). */
  month: string
}

type Row = {
  id: string
  user_id: string
  appeal_date: string
  requested_status: string
  appeal_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

/**
 * Approved appeals decided by the person they are about: the Admin & HR Lead deciding her
 * own, or her delegate doing so while she was on approved leave. Nobody else can approve
 * their own appeal (appealReviewBlock), so "reviewed by the appellant" identifies them.
 * They are listed for the MD in MD's Desk, with a monthly in-app notice, so someone
 * above the chain looks at them afterwards.
 */
export async function loadSelfApprovedAppeals(
  client: SupabaseClient,
  params: { fromIso: string; toIso?: string }
): Promise<SelfApprovedAppeal[]> {
  let query = client
    .from("attendance_appeals")
    .select("id, user_id, appeal_date, requested_status, appeal_reason, reviewed_by, reviewed_at")
    .eq("status", "approved")
    .not("reviewed_by", "is", null)
    .gte("reviewed_at", params.fromIso)
    .order("reviewed_at", { ascending: false })
  if (params.toIso) query = query.lt("reviewed_at", params.toIso)
  const { data, error } = await query.returns<Row[]>()
  if (error) throw new Error(`Failed to load self-approved appeals: ${error.message}`)

  const own = (data ?? []).filter((row) => row.reviewed_by === row.user_id && row.reviewed_at)
  if (own.length === 0) return []

  const { data: people } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name")
    .in("id", [...new Set(own.map((row) => row.user_id))])
    .returns<Array<{ id: string; full_name: string | null; first_name: string | null; last_name: string | null }>>()
  const names = new Map(
    (people ?? []).map((p) => [
      p.id,
      p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
    ])
  )

  return own.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: names.get(row.user_id) ?? "Unknown",
    appeal_date: row.appeal_date,
    requested_status: row.requested_status,
    appeal_reason: row.appeal_reason,
    reviewed_at: row.reviewed_at as string,
    month: toLocalISODate(new Date(row.reviewed_at as string)).slice(0, 7),
  }))
}

/** Self-approved appeals from roughly the last six months, for the MD's Desk list. */
export async function loadRecentSelfApprovedAppeals(client: SupabaseClient): Promise<SelfApprovedAppeal[]> {
  const fromIso = new Date(Date.now() - 183 * 86_400_000).toISOString()
  return loadSelfApprovedAppeals(client, { fromIso })
}

/** The previous calendar month in WAT: [start, end) as ISO instants, plus its label. */
export function previousMonthWindow(now: Date): { fromIso: string; toIso: string; label: string } {
  const today = toLocalISODate(now) // WAT date
  const [year, month] = today.split("-").map(Number)
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  // WAT is UTC+1: a WAT midnight is 23:00 UTC the day before.
  const start = new Date(Date.UTC(prevYear, prevMonth - 1, 1) - 60 * 60 * 1000)
  const end = new Date(Date.UTC(year, month - 1, 1) - 60 * 60 * 1000)
  const label = formatWATDate(new Date(Date.UTC(prevYear, prevMonth - 1, 1)), {
    month: "long",
    year: "numeric",
    day: undefined,
  })
  return { fromIso: start.toISOString(), toIso: end.toISOString(), label }
}

/** The MD (lead of Executive Management) and everyone on the MD's Desk delegate list. */
export async function loadMdDeskMemberIds(client: SupabaseClient): Promise<string[]> {
  const leads = await loadDepartmentLeads(client)
  const ids = new Set(leads.idsByDepartment.get(DEPT_EXECUTIVE_MANAGEMENT) ?? [])
  const { data } = await client.from("md_desk_delegates").select("profile_id").returns<Array<{ profile_id: string }>>()
  for (const row of data ?? []) ids.add(row.profile_id)
  return [...ids]
}

/**
 * The monthly in-app notice to the MD's Desk: how many appeals were self-approved last
 * month, linking to the list. Sends nothing when there were none.
 */
export async function notifySelfApprovedMonthly(
  client: SupabaseClient,
  now: Date = new Date()
): Promise<{ count: number; notified: number }> {
  const window = previousMonthWindow(now)
  const appeals = await loadSelfApprovedAppeals(client, { fromIso: window.fromIso, toIso: window.toIso })
  if (appeals.length === 0) return { count: 0, notified: 0 }

  const people = [...new Set(appeals.map((a) => a.user_name))].join(", ")
  const recipients = await loadMdDeskMemberIds(client)
  for (const userId of recipients) {
    const { error } = await createNotification({
      p_user_id: userId,
      p_type: "system",
      p_category: "approvals",
      p_title: `Self-approved attendance appeals — ${window.label}`,
      p_message: `${appeals.length} attendance appeal day(s) were approved by the person they are about in ${window.label}: ${people}.`,
      p_priority: "normal",
      p_link_url: "/md-desk/self-approved",
      p_entity_type: "attendance_appeal",
    })
    if (error) log.error({ err: error.message, userId }, "Could not notify the MD's Desk of self-approved appeals")
  }
  return { count: appeals.length, notified: recipients.length }
}
