import type { SupabaseClient } from "@supabase/supabase-js"
import { formatName } from "@/lib/utils"
import { addIsoDays } from "@/lib/hr/leave-days"
import { logger } from "@/lib/logger"

const log = logger("lib-admin-away-today")

export interface AwayTodayItem {
  userId: string
  name: string
  department: string | null
  reason: "leave" | "out_of_station"
  /** Leave type name, or "Out of station". */
  label: string
  /** Last day away (YYYY-MM-DD), when known. */
  until: string | null
  indefinite: boolean
}

type LeaveTodayRow = {
  user_id: string
  end_date: string
  leave_type: { name: string | null } | { name: string | null }[] | null
  leave_request_segments: { start_date: string; end_date: string }[] | null
}

type DatedUserRow = { user_id: string; date: string }
type OpenOosRow = { user_id: string }
type NameRow = { id: string; first_name: string | null; last_name: string | null; department: string | null }

/** Look-ahead for a bounded OOS run; bulk OOS ranges are materialized up front. */
const OOS_LOOKAHEAD_DAYS = 90
/** A weekend or holiday inside an OOS run leaves a gap of up to this many days. */
const OOS_RUN_GAP_DAYS = 4

/**
 * Staff on approved leave or Out of Station today, for the admin dashboard.
 *
 * Leave comes from approved `leave_requests` covering today; a split request is
 * only "away" on the days its segments cover, so segments win over the
 * request's overall range. OOS is materialized one `attendance_records` row per
 * day (`out_of_station`), so today's rows say who is out and the run of future
 * rows says until when; an open `attendance_oos_periods` directive means it has
 * no end date yet.
 *
 * `scopedUserIds` null means org-wide; an array limits to those people.
 */
export async function loadAwayToday(
  dataClient: SupabaseClient,
  todayIso: string,
  scopedUserIds: string[] | null
): Promise<AwayTodayItem[]> {
  if (scopedUserIds && scopedUserIds.length === 0) return []

  let leaveQ = dataClient
    .from("leave_requests")
    .select("user_id, end_date, leave_type:leave_types(name), leave_request_segments(start_date, end_date)")
    .eq("status", "approved")
    .lte("start_date", todayIso)
    .gte("end_date", todayIso)
  let oosQ = dataClient
    .from("attendance_records")
    .select("user_id, date")
    .eq("date", todayIso)
    .eq("status", "out_of_station")
  if (scopedUserIds) {
    leaveQ = leaveQ.in("user_id", scopedUserIds)
    oosQ = oosQ.in("user_id", scopedUserIds)
  }

  const [leaveResult, oosResult] = await Promise.all([
    leaveQ.returns<LeaveTodayRow[]>(),
    oosQ.returns<DatedUserRow[]>(),
  ])
  if (leaveResult.error) log.error("away-today leave query failed", leaveResult.error)
  if (oosResult.error) log.error("away-today OOS query failed", oosResult.error)

  const leaveByUser = new Map<string, { label: string; until: string }>()
  for (const row of leaveResult.data || []) {
    const segments = row.leave_request_segments || []
    const segment = segments.find((s) => s.start_date <= todayIso && s.end_date >= todayIso)
    if (segments.length > 0 && !segment) continue
    const leaveType = Array.isArray(row.leave_type) ? row.leave_type[0] : row.leave_type
    leaveByUser.set(row.user_id, { label: leaveType?.name || "Leave", until: segment?.end_date || row.end_date })
  }

  // Leave outranks OOS for the same person, matching attendance precedence.
  const oosUserIds = Array.from(new Set((oosResult.data || []).map((row) => row.user_id))).filter(
    (id) => !leaveByUser.has(id)
  )

  const [futureOos, openOos] =
    oosUserIds.length > 0
      ? await Promise.all([
          dataClient
            .from("attendance_records")
            .select("user_id, date")
            .eq("status", "out_of_station")
            .in("user_id", oosUserIds)
            .gt("date", todayIso)
            .lte("date", addIsoDays(todayIso, OOS_LOOKAHEAD_DAYS))
            .order("date", { ascending: true })
            .returns<DatedUserRow[]>(),
          dataClient
            .from("attendance_oos_periods")
            .select("user_id")
            .in("user_id", oosUserIds)
            .is("end_date", null)
            .eq("status", "active")
            .returns<OpenOosRow[]>(),
        ])
      : [
          { data: [] as DatedUserRow[], error: null },
          { data: [] as OpenOosRow[], error: null },
        ]
  if (futureOos.error) log.error("away-today OOS run query failed", futureOos.error)
  if (openOos.error) log.error("away-today open OOS query failed", openOos.error)

  const indefinite = new Set((openOos.data || []).map((row) => row.user_id))
  const oosUntil = new Map<string, string>(oosUserIds.map((id) => [id, todayIso]))
  for (const row of futureOos.data || []) {
    const current = oosUntil.get(row.user_id)
    // Rows arrive in date order; extend the run only while it stays contiguous.
    if (current && row.date <= addIsoDays(current, OOS_RUN_GAP_DAYS)) oosUntil.set(row.user_id, row.date)
  }

  const userIds = [...leaveByUser.keys(), ...oosUserIds]
  if (userIds.length === 0) return []

  const { data: people, error: peopleError } = await dataClient
    .from("profiles")
    .select("id, first_name, last_name, department")
    .in("id", userIds)
    .returns<NameRow[]>()
  if (peopleError) log.error("away-today name lookup failed", peopleError)
  const byId = new Map((people || []).map((person) => [person.id, person]))

  const nameOf = (id: string) => {
    const person = byId.get(id)
    const name = [formatName(person?.first_name || ""), formatName(person?.last_name || "")].filter(Boolean).join(" ")
    return { name: name || "Unknown staff", department: person?.department || null }
  }

  const items: AwayTodayItem[] = [
    ...[...leaveByUser.entries()].map(([userId, leave]) => ({
      userId,
      ...nameOf(userId),
      reason: "leave" as const,
      label: leave.label,
      until: leave.until,
      indefinite: false,
    })),
    ...oosUserIds.map((userId) => ({
      userId,
      ...nameOf(userId),
      reason: "out_of_station" as const,
      label: "Out of station",
      until: indefinite.has(userId) ? null : oosUntil.get(userId) || null,
      indefinite: indefinite.has(userId),
    })),
  ]

  return items.sort((a, b) => a.name.localeCompare(b.name))
}
