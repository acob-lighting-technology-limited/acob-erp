import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { EventWriteSchema, describeEventDbError } from "@/lib/events/types"
import { getEventsSession, resolveDepartmentMembers } from "@/lib/events/server"
import { auditEventValues, eventRowFromInput, uniqueIds } from "@/lib/events/write"

export const dynamic = "force-dynamic"
const log = logger("api-events-id")

const IdSchema = z.string().uuid()

// Edits run as the caller: the events UPDATE policy and events_guard_write
// trigger decide what they may change. An update that matches zero rows means
// the caller cannot manage this event (or it does not exist).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`events-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const parsed = EventWriteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid event" }, { status: 400 })
  }
  const input = parsed.data

  const { data: updated, error } = await session.supabase
    .from("events")
    .update(eventRowFromInput(input))
    .eq("id", id)
    .select("id")

  if (error) {
    const described = describeEventDbError(error)
    if (described.status === 500) log.error({ err: error, id }, "Failed to update event")
    return NextResponse.json({ error: described.message }, { status: described.status })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Event not found or you can't edit it" }, { status: 404 })
  }

  // Sync the invite list, keeping existing rows so their RSVPs survive the edit.
  let inviteWarning: string | null = null
  try {
    const departmentMembers = await resolveDepartmentMembers(session, input.invite_department_ids)
    const desired = new Set(uniqueIds([...input.attendee_ids, ...departmentMembers]))

    const { data: existingRows, error: existingError } = await session.supabase
      .from("event_attendees")
      .select("profile_id")
      .eq("event_id", id)
    if (existingError) throw existingError
    const existing = new Set(((existingRows ?? []) as { profile_id: string }[]).map((r) => r.profile_id))

    const toRemove = [...existing].filter((pid) => !desired.has(pid))
    const toAdd = [...desired].filter((pid) => !existing.has(pid))

    if (toRemove.length) {
      const { error: removeError } = await session.supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", id)
        .in("profile_id", toRemove)
      if (removeError) throw removeError
    }
    if (toAdd.length) {
      const { error: addError } = await session.supabase
        .from("event_attendees")
        .insert(toAdd.map((profile_id) => ({ event_id: id, profile_id })))
      if (addError) throw addError
    }
  } catch (err) {
    log.error({ err, id }, "Event updated but invitees failed to sync")
    inviteWarning = "Event saved, but the invite list could not be updated. Try saving again."
  }

  await writeAuditLog(
    session.supabase,
    {
      action: "update",
      entityType: "event",
      entityId: id,
      newValues: auditEventValues(input),
      context: { actorId: session.userId, source: "api", route: "/api/events/[id]" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ id, warning: inviteWarning })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`events-write:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid event id" }, { status: 400 })

  const { data: deleted, error } = await session.supabase
    .from("events")
    .delete()
    .eq("id", id)
    .select("id, type, visibility, status, md_involvement, start_at, end_at")

  if (error) {
    const described = describeEventDbError(error)
    if (described.status === 500) log.error({ err: error, id }, "Failed to delete event")
    return NextResponse.json({ error: described.message }, { status: described.status })
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Event not found or you can't delete it" }, { status: 404 })
  }

  await writeAuditLog(
    session.supabase,
    {
      action: "delete",
      entityType: "event",
      entityId: id,
      oldValues: deleted[0] as Record<string, unknown>,
      context: { actorId: session.userId, source: "api", route: "/api/events/[id]" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true })
}
