import { NextRequest, NextResponse } from "next/server"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { EventWriteSchema, describeEventDbError, type EventsResponse } from "@/lib/events/types"
import { getEventsSession, loadEvents, parseRange, resolveDepartmentMembers } from "@/lib/events/server"
import { auditEventValues, eventRowFromInput, uniqueIds } from "@/lib/events/write"
import { generateEventOccurrences } from "@/lib/events/recurrence"
import { toLocalISODate } from "@/lib/utils/date"

export const dynamic = "force-dynamic"
const log = logger("api-events")

// Company calendar. Visibility is enforced by RLS on events (see
// lib/events/server.ts) — this route never filters by role itself.
export async function GET(request: NextRequest) {
  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const range = parseRange(searchParams)
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 })
  const scope = searchParams.get("scope") === "md" ? "md" : "all"

  try {
    const result: EventsResponse = await loadEvents(session, { ...range, scope })
    return NextResponse.json(result)
  } catch (err) {
    log.error({ err }, "Failed to load events")
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(`events-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = EventWriteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid event" }, { status: 400 })
  }
  const input = parsed.data

  const recurrence = input.recurrence
  const isRecurring = Boolean(recurrence && recurrence.frequency !== "none")

  let scheduledRanges: Array<{ start_at: string; end_at: string }> = [
    { start_at: input.start_at, end_at: input.end_at },
  ]
  let skippedHolidaysList: string[] = []

  if (isRecurring && recurrence) {
    const holidayDates = new Set<string>()
    if (recurrence.skip_holidays) {
      try {
        const startIsoDate = toLocalISODate(new Date(input.start_at))
        const [holidayCalendarRes, holidayEventsRes] = await Promise.all([
          session.supabase.from("holiday_calendar").select("holiday_date").gte("holiday_date", startIsoDate),
          session.supabase
            .from("events")
            .select("start_at, end_at")
            .eq("type", "holiday")
            .neq("status", "cancelled")
            .gte("end_at", input.start_at),
        ])

        if (holidayCalendarRes.data) {
          for (const row of holidayCalendarRes.data as Array<{ holiday_date: string }>) {
            if (row.holiday_date) holidayDates.add(row.holiday_date)
          }
        }
        if (holidayEventsRes.data) {
          for (const row of holidayEventsRes.data as Array<{ start_at: string; end_at: string }>) {
            const dateIso = toLocalISODate(new Date(row.start_at))
            holidayDates.add(dateIso)
          }
        }
      } catch (err) {
        log.warn({ err }, "Could not fetch holidays for recurrence check")
      }
    }

    const occurrences = generateEventOccurrences({
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day,
      frequency: recurrence.frequency,
      count: recurrence.count,
      until: recurrence.until,
      holidayDates,
      skip_holidays: recurrence.skip_holidays,
    })

    scheduledRanges = occurrences.scheduled
    skippedHolidaysList = occurrences.skippedHolidays

    if (scheduledRanges.length === 0) {
      return NextResponse.json(
        { error: "All recurrence dates fall on public holidays and were skipped." },
        { status: 400 }
      )
    }
  }

  const baseRow = eventRowFromInput(input)
  const rowsToInsert = scheduledRanges.map((range) => ({
    ...baseRow,
    start_at: range.start_at,
    end_at: range.end_at,
    created_by: session.userId,
  }))

  const { data: created, error } = await session.supabase.from("events").insert(rowsToInsert).select("id")

  if (error || !created || created.length === 0) {
    const described = describeEventDbError(error)
    if (described.status === 500) log.error({ err: error }, "Failed to create event")
    return NextResponse.json({ error: described.message }, { status: described.status })
  }

  const eventIds = created.map((r: { id: string }) => String(r.id))
  const primaryEventId = eventIds[0]
  let inviteWarning: string | null = null

  if (input.attendee_ids.length > 0 || input.invite_department_ids.length > 0) {
    try {
      const departmentMembers = await resolveDepartmentMembers(session, input.invite_department_ids)
      const attendeeProfileIds = uniqueIds([...input.attendee_ids, ...departmentMembers])
      if (attendeeProfileIds.length > 0) {
        const attendeeRows = eventIds.flatMap((eid) =>
          attendeeProfileIds.map((profile_id) => ({
            event_id: eid,
            profile_id,
          }))
        )
        const { error: attendeeError } = await session.supabase.from("event_attendees").insert(attendeeRows)
        if (attendeeError) throw attendeeError
      }
    } catch (err) {
      log.error({ err, primaryEventId }, "Events created but invitees failed to save")
      inviteWarning = "Event saved, but the invite list could not be saved. Edit the event to add invitees."
    }
  }

  await writeAuditLog(
    session.supabase,
    {
      action: "create",
      entityType: "event",
      entityId: primaryEventId,
      newValues: auditEventValues(input),
      context: { actorId: session.userId, source: "api", route: "/api/events" },
    },
    { failOpen: true }
  )

  let recurrenceMessage: string | null = null
  if (isRecurring) {
    if (skippedHolidaysList.length > 0) {
      recurrenceMessage = `Created ${scheduledRanges.length} recurring occurrences (${skippedHolidaysList.length} skipped on public holidays).`
    } else {
      recurrenceMessage = `Created ${scheduledRanges.length} recurring occurrences.`
    }
  }

  return NextResponse.json(
    {
      id: primaryEventId,
      count: scheduledRanges.length,
      skipped_holidays: skippedHolidaysList,
      message: recurrenceMessage,
      warning: inviteWarning,
    },
    { status: 201 }
  )
}
