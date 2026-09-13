import { NextRequest, NextResponse } from "next/server"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { EventWriteSchema, describeEventDbError, type EventsResponse } from "@/lib/events/types"
import { getEventsSession, loadEvents, parseRange, resolveDepartmentMembers } from "@/lib/events/server"
import { auditEventValues, eventRowFromInput, uniqueIds } from "@/lib/events/write"

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

  const { data: created, error } = await session.supabase
    .from("events")
    .insert({ ...eventRowFromInput(input), created_by: session.userId })
    .select("id")
    .single()

  if (error || !created) {
    const described = describeEventDbError(error)
    if (described.status === 500) log.error({ err: error }, "Failed to create event")
    return NextResponse.json({ error: described.message }, { status: described.status })
  }

  const eventId = String(created.id)
  let inviteWarning: string | null = null
  try {
    const departmentMembers = await resolveDepartmentMembers(session, input.invite_department_ids)
    const rows = uniqueIds([...input.attendee_ids, ...departmentMembers]).map((profile_id) => ({
      event_id: eventId,
      profile_id,
    }))
    if (rows.length) {
      const { error: attendeeError } = await session.supabase.from("event_attendees").insert(rows)
      if (attendeeError) throw attendeeError
    }
  } catch (err) {
    // The event exists; tell the user the invite list needs another try rather
    // than failing the whole request and leaving them to create a duplicate.
    log.error({ err, eventId }, "Event created but invitees failed to save")
    inviteWarning = "Event saved, but the invite list could not be saved. Edit the event to add invitees."
  }

  await writeAuditLog(
    session.supabase,
    {
      action: "create",
      entityType: "event",
      entityId: eventId,
      newValues: auditEventValues(input),
      context: { actorId: session.userId, source: "api", route: "/api/events" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ id: eventId, warning: inviteWarning }, { status: 201 })
}
