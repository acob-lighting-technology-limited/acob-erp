import { NextRequest, NextResponse } from "next/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireApiAdminScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { logger } from "@/lib/logger"
import { addIsoDays } from "@/lib/hr/leave-days"
import { toLocalISODate } from "@/lib/utils/date"
import {
  MANUAL_CHANGE_EVENT_TYPES,
  AUTOMATIC_EVENT_SOURCES,
  describeChangeEvent,
  splitChangeComment,
  groupChangeLogEntries,
  type ChangeLogEntry,
  type ChangeLogAppeal,
  type ChangeLogRow,
} from "@/lib/hr/attendance-change-log"

const log = logger("admin-hr-attendance-change-log")
export const dynamic = "force-dynamic"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** Default window when no dates are given. */
const DEFAULT_DAYS = 30
/** Ceiling per request; a wider window should be narrowed with dates rather than paged. */
const MAX_ROWS = 5000

type EventRow = {
  id: string
  user_id: string
  event_date: string
  event_type: string
  from_status: string | null
  to_status: string | null
  source: string | null
  comment: string | null
  actor_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
}

function displayName(profile: ProfileRow | undefined): string {
  if (!profile) return "Unknown"
  return profile.full_name?.trim() || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown"
}

/**
 * GET /api/admin/hr/attendance/change-log?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Every change a person made to attendance between `from` and `to` (by when it
 * was made, WAT), newest first. Automatic changes are excluded.
 * Department leads only see their departments, as on the Appeals tab.
 */
export async function GET(request: NextRequest) {
  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult
    const dataClient = getServiceRoleClientOrFallback(supabase)

    const params = request.nextUrl.searchParams
    const today = toLocalISODate()
    const to = params.get("to") || today
    const from = params.get("from") || addIsoDays(to, -(DEFAULT_DAYS - 1))
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
      return NextResponse.json({ error: "from and to must be dates, with from on or before to" }, { status: 400 })
    }

    let scopedUserIds: string[] | null = null
    const depts = getScopedDepartments(scope)
    if (depts !== null) {
      if (depts.length === 0) return NextResponse.json({ data: [], truncated: false })
      const { data: scoped } = await dataClient.from("profiles").select("id").in("department", depts)
      scopedUserIds = (scoped ?? []).map((p: { id: string }) => p.id)
      if (scopedUserIds.length === 0) return NextResponse.json({ data: [], truncated: false })
    }

    // WAT is UTC+1 with no DST, so the window is [from 00:00 WAT, to+1 00:00 WAT).
    let query = dataClient
      .from("attendance_events")
      .select(
        "id, user_id, event_date, event_type, from_status, to_status, source, comment, actor_id, metadata, created_at"
      )
      .in("event_type", [...MANUAL_CHANGE_EVENT_TYPES])
      // `.not in` drops null sources too, so keep them explicitly: older manual rows may lack one.
      .or(`source.is.null,source.not.in.(${AUTOMATIC_EVENT_SOURCES.join(",")})`)
      .gte("created_at", `${from}T00:00:00+01:00`)
      .lt("created_at", `${addIsoDays(to, 1)}T00:00:00+01:00`)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS + 1)
    if (scopedUserIds) query = query.in("user_id", scopedUserIds)

    const { data: events, error } = await query.returns<EventRow[]>()
    if (error) {
      log.error({ err: error.message }, "Failed to load change log")
      return NextResponse.json({ error: "Failed to load change log" }, { status: 500 })
    }

    const truncated = (events ?? []).length > MAX_ROWS
    const rows = (events ?? []).slice(0, MAX_ROWS)
    if (rows.length === 0) return NextResponse.json({ data: [], truncated: false })

    const personIds = [
      ...new Set(rows.flatMap((row) => [row.user_id, row.actor_id]).filter((id): id is string => Boolean(id))),
    ]
    const appealIds = [
      ...new Set(
        rows.map((row) => row.metadata?.appeal_id).filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ]

    const [{ data: people }, { data: appeals }] = await Promise.all([
      dataClient
        .from("profiles")
        .select("id, full_name, first_name, last_name, department")
        .in("id", personIds)
        .returns<ProfileRow[]>(),
      appealIds.length > 0
        ? dataClient
            .from("attendance_appeals")
            .select("id, status, requested_status, appeal_reason, resolution_note")
            .in("id", appealIds)
            .returns<ChangeLogAppeal[]>()
        : Promise.resolve({ data: [] as ChangeLogAppeal[] }),
    ])
    const personById = new Map((people ?? []).map((person) => [person.id, person]))
    const appealById = new Map((appeals ?? []).map((appeal) => [appeal.id, appeal]))

    const entries: ChangeLogEntry[] = rows.map((row) => {
      const { category, label } = describeChangeEvent(row)
      const employee = personById.get(row.user_id)
      // A manual row without an actor predates actor capture; say so rather than guess.
      const actorName = row.actor_id ? displayName(personById.get(row.actor_id)) : "Not recorded"
      const appealId = typeof row.metadata?.appeal_id === "string" ? row.metadata.appeal_id : null
      const { comment, details } = splitChangeComment(row)
      return {
        id: row.id,
        changed_at: row.created_at,
        day: row.event_date,
        event_type: row.event_type,
        category,
        change_label: label,
        actor_id: row.actor_id,
        actor_name: actorName,
        employee_id: row.user_id,
        employee_name: displayName(employee),
        department: employee?.department ?? "",
        from_status: row.from_status,
        to_status: row.to_status,
        comment,
        details,
        appeal: appealId ? (appealById.get(appealId) ?? null) : null,
      }
    })

    const data: ChangeLogRow[] = groupChangeLogEntries(entries)
    return NextResponse.json({ data, truncated })
  } catch (err) {
    log.error({ err: String(err) }, "Error in GET /api/admin/hr/attendance/change-log")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
