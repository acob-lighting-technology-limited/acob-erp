import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"
import { toLocalISODate } from "@/lib/utils/date"
import type {
  BusyBlock,
  CalendarEvent,
  EventAttendee,
  EventCapabilities,
  EventLocationType,
  EventOptions,
  EventRsvp,
  EventStatus,
  EventType,
  EventVisibility,
  MdInvolvement,
} from "@/lib/events/types"

const log = logger("events")

/** Busy-block lookups are capped at 93 days by get_md_busy_blocks. */
export const MAX_RANGE_DAYS = 93

type EventRow = {
  id: string
  type: EventType
  title: string
  description: string | null
  start_at: string
  end_at: string
  all_day: boolean
  location_type: EventLocationType
  room_id: string | null
  venue: string | null
  meeting_url: string | null
  visibility: EventVisibility
  department_id: string | null
  md_involvement: MdInvolvement
  status: EventStatus
  organizer_id: string | null
  created_by: string
}

type AttendeeRow = {
  event_id: string
  profile_id: string
  rsvp: EventRsvp
  attended: boolean | null
}

type DirectoryRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
  employment_status: string | null
}

const EVENT_COLUMNS =
  "id, type, title, description, start_at, end_at, all_day, location_type, room_id, venue, meeting_url, visibility, department_id, md_involvement, status, organizer_id, created_by"

export type EventsSession = {
  supabase: SupabaseClient
  userId: string
}

/**
 * Every events route runs as the signed-in user. RLS on events / event_attendees
 * is the access model, so reads and writes deliberately use the session client —
 * the service role would bypass exactly the rules this feature depends on.
 */
export async function getEventsSession(): Promise<EventsSession | null> {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, userId: user.id }
}

function displayName(row: DirectoryRow | undefined): string {
  if (!row) return "Unknown"
  return row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unknown"
}

export type LoadEventsOptions = {
  from: Date
  to: Date
  /** "md" limits to events on the MD's schedule. */
  scope?: "all" | "md"
  includeBusy?: boolean
}

/** Projects holiday_calendar rows into synthetic read-only CalendarEvent objects. */
async function mergeHolidays(supabase: SupabaseClient, from: Date, to: Date, target: CalendarEvent[]): Promise<void> {
  const fromDate = toLocalISODate(from)
  const toDate = toLocalISODate(new Date(to.getTime() - 1)) // inclusive end
  const { data: holidayRows } = await supabase
    .from("holiday_calendar")
    .select("holiday_date, name, location")
    .gte("holiday_date", fromDate)
    .lte("holiday_date", toDate)
    .eq("is_business_day", false)
    .order("holiday_date", { ascending: true })
  for (const h of (holidayRows ?? []) as { holiday_date: string; name: string; location: string }[]) {
    // Span the entire WAT day: midnight → 23:59:59 +01:00.
    const dayStart = `${h.holiday_date}T00:00:00+01:00`
    const dayEnd = `${h.holiday_date}T23:59:59+01:00`
    target.push({
      id: `holiday-${h.holiday_date}-${h.location}`,
      type: "holiday",
      title: h.name,
      description: null,
      start_at: dayStart,
      end_at: dayEnd,
      all_day: true,
      location_type: "physical",
      room_id: null,
      room_name: null,
      venue: null,
      meeting_url: null,
      visibility: "company",
      department_id: null,
      department_name: null,
      md_involvement: "none",
      status: "scheduled",
      organizer_id: null,
      organizer_name: null,
      created_by: "",
      attendees: [],
      my_rsvp: null,
      can_manage: false,
    })
  }
}

export async function loadEvents(
  session: EventsSession,
  { from, to, scope = "all", includeBusy = true }: LoadEventsOptions
): Promise<{ events: CalendarEvent[]; busy: BusyBlock[] }> {
  const { supabase, userId } = session

  let query = supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .lt("start_at", to.toISOString())
    .gt("end_at", from.toISOString())
    .order("start_at", { ascending: true })
  if (scope === "md") query = query.neq("md_involvement", "none")

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as EventRow[]

  const busyPromise = includeBusy
    ? supabase.rpc("get_md_busy_blocks", { p_from: from.toISOString(), p_to: to.toISOString() })
    : Promise.resolve({ data: [] as BusyBlock[], error: null })

  if (rows.length === 0) {
    const { data: busy, error: busyError } = await busyPromise
    if (busyError) log.warn({ err: busyError.message }, "Failed to load busy blocks")
    const emptyEvents: CalendarEvent[] = []
    // Holidays still need to appear even when there are no calendar events this month.
    if (scope !== "md") await mergeHolidays(supabase, from, to, emptyEvents)
    return { events: emptyEvents, busy: (busy ?? []) as BusyBlock[] }
  }

  const ids = rows.map((r) => r.id)
  const roomIds = Array.from(new Set(rows.map((r) => r.room_id).filter((v): v is string => Boolean(v))))
  const deptIds = Array.from(new Set(rows.map((r) => r.department_id).filter((v): v is string => Boolean(v))))

  const [attendeesRes, manageableRes, roomsRes, deptsRes, busyRes] = await Promise.all([
    supabase.from("event_attendees").select("event_id, profile_id, rsvp, attended").in("event_id", ids),
    supabase.rpc("manageable_event_ids", { p_event_ids: ids }),
    roomIds.length
      ? supabase.from("office_locations").select("id, name").in("id", roomIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    deptIds.length
      ? supabase.from("departments").select("id, name").in("id", deptIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    busyPromise,
  ])

  if (attendeesRes.error) throw attendeesRes.error
  if (manageableRes.error) throw manageableRes.error
  if (busyRes.error) log.warn({ err: busyRes.error.message }, "Failed to load busy blocks")

  const attendees = (attendeesRes.data ?? []) as AttendeeRow[]
  const manageable = new Set(((manageableRes.data ?? []) as unknown[]).map((v) => String(v)))

  const peopleIds = Array.from(
    new Set([
      ...attendees.map((a) => a.profile_id),
      ...rows.map((r) => r.organizer_id).filter((v): v is string => Boolean(v)),
    ])
  )
  const directory = new Map<string, DirectoryRow>()
  if (peopleIds.length) {
    // staff_directory, not profiles: profiles RLS shows an employee only their own row.
    const { data: people, error: peopleError } = await supabase
      .from("staff_directory")
      .select("id, full_name, first_name, last_name, department, employment_status")
      .in("id", peopleIds)
    if (peopleError) log.warn({ err: peopleError.message }, "Failed to resolve attendee names")
    for (const p of (people ?? []) as DirectoryRow[]) directory.set(p.id, p)
  }

  const roomNames = new Map(((roomsRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]))
  const deptNames = new Map(((deptsRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]))

  const attendeesByEvent = new Map<string, EventAttendee[]>()
  for (const a of attendees) {
    const person = directory.get(a.profile_id)
    const list = attendeesByEvent.get(a.event_id) ?? []
    list.push({
      profile_id: a.profile_id,
      name: displayName(person),
      department: person?.department ?? null,
      rsvp: a.rsvp,
      attended: a.attended,
    })
    attendeesByEvent.set(a.event_id, list)
  }

  const events: CalendarEvent[] = rows.map((r) => {
    const list = (attendeesByEvent.get(r.id) ?? []).sort((x, y) => x.name.localeCompare(y.name))
    return {
      ...r,
      room_name: r.room_id ? (roomNames.get(r.room_id) ?? null) : null,
      department_name: r.department_id ? (deptNames.get(r.department_id) ?? null) : null,
      organizer_name: r.organizer_id ? displayName(directory.get(r.organizer_id)) : null,
      attendees: list,
      my_rsvp: list.find((a) => a.profile_id === userId)?.rsvp ?? null,
      can_manage: manageable.has(r.id),
    }
  })

  // Merge public holidays from holiday_calendar as synthetic all-day events.
  // Done only for the "all" scope — MD's Desk is already a focused personal schedule.
  if (scope !== "md") await mergeHolidays(supabase, from, to, events)

  return { events, busy: (busyRes.data ?? []) as BusyBlock[] }
}

/**
 * Count of upcoming scheduled events where the current user is an invitee
 * and has not responded yet (rsvp = "pending").
 */
export async function loadPendingRsvpCount(session: EventsSession): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await session.supabase
    .from("event_attendees")
    .select("id, events!inner(id)")
    .eq("profile_id", session.userId)
    .eq("rsvp", "pending")
    .eq("events.status", "scheduled")
    .gt("events.end_at", now)

  if (error) {
    log.error({ err: error.message }, "Failed to count pending RSVPs")
    return 0
  }
  return data?.length ?? 0
}

export async function loadEventCapabilities(session: EventsSession): Promise<EventCapabilities> {
  const { supabase, userId } = session
  const [manager, mdDesk, create, profile] = await Promise.all([
    supabase.rpc("is_event_manager"),
    supabase.rpc("can_edit_md_desk"),
    supabase.rpc("can_create_events"),
    supabase.from("profiles").select("is_department_lead, lead_department_ids").eq("id", userId).maybeSingle(),
  ])

  const isEventManager = manager.data === true
  const canEditMdDesk = mdDesk.data === true
  const leadIds = ((profile.data?.lead_department_ids as string[] | null) ?? []).filter(Boolean)

  return {
    canCreate: create.data === true,
    isEventManager,
    canEditMdDesk,
    allowedDepartmentIds: isEventManager || canEditMdDesk ? null : leadIds,
  }
}

export async function loadEventOptions(session: EventsSession): Promise<EventOptions> {
  const { supabase } = session
  const capabilities = await loadEventCapabilities(session)

  const [roomsRes, deptsRes, staffRes] = await Promise.all([
    supabase.from("office_locations").select("id, name, type").eq("is_active", true).order("name"),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    capabilities.canCreate
      ? supabase
          .from("staff_directory")
          .select("id, full_name, first_name, last_name, department, employment_status")
          .order("full_name")
      : Promise.resolve({ data: [] as DirectoryRow[], error: null }),
  ])

  const departments = (deptsRes.data ?? []) as { id: string; name: string }[]
  const deptIdByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]))

  const staff = ((staffRes.data ?? []) as DirectoryRow[])
    .filter((p) => (p.employment_status || "").toLowerCase() !== "exited")
    .map((p) => ({
      id: p.id,
      name: displayName(p),
      department: p.department,
      department_id: p.department ? (deptIdByName.get(p.department.toLowerCase()) ?? null) : null,
    }))

  return {
    capabilities,
    rooms: (roomsRes.data ?? []) as EventOptions["rooms"],
    departments,
    staff,
  }
}

/**
 * Current, non-exited members of the given departments. Uses the service role
 * because a Corporate Services officer cannot read other departments' profiles —
 * callers must only reach this after the event write itself passed RLS.
 */
export async function resolveDepartmentMembers(session: EventsSession, departmentIds: string[]): Promise<string[]> {
  if (departmentIds.length === 0) return []
  const db = getServiceRoleClientOrFallback(session.supabase)
  const { data, error } = await db.from("profiles").select("id, employment_status").in("department_id", departmentIds)
  if (error) throw error
  return ((data ?? []) as { id: string; employment_status: string | null }[])
    .filter((p) => (p.employment_status || "").toLowerCase() !== "exited")
    .map((p) => p.id)
}

/** Parses ?from=&to= into a bounded range; defaults to the current month ± a week. */
export function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } | { error: string } {
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  defaultFrom.setDate(defaultFrom.getDate() - 7)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  defaultTo.setDate(defaultTo.getDate() + 7)

  const from = searchParams.get("from") ? new Date(String(searchParams.get("from"))) : defaultFrom
  const to = searchParams.get("to") ? new Date(String(searchParams.get("to"))) : defaultTo
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { error: "Invalid date range" }
  if (to <= from) return { error: "Range end must be after start" }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    return { error: `Range must be ${MAX_RANGE_DAYS} days or less` }
  }
  return { from, to }
}
