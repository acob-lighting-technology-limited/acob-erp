import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { RsvpSchema, describeEventDbError } from "@/lib/events/types"
import { getEventsSession } from "@/lib/events/server"

export const dynamic = "force-dynamic"
const log = logger("api-events-rsvp")

// An invitee answers their own invitation. The attendee UPDATE policy limits this
// to the caller's row, and event_attendees_guard_self_update stamps responded_at.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(`events-rsvp:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 })
  }

  const parsed = RsvpSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid response" }, { status: 400 })

  const { data, error } = await session.supabase
    .from("event_attendees")
    .update({ rsvp: parsed.data.rsvp })
    .eq("event_id", id)
    .eq("profile_id", session.userId)
    .select("rsvp")

  if (error) {
    const described = describeEventDbError(error)
    if (described.status === 500) log.error({ err: error, id }, "Failed to save RSVP")
    return NextResponse.json({ error: described.message }, { status: described.status })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "You're not invited to this event" }, { status: 404 })
  }

  return NextResponse.json({ rsvp: parsed.data.rsvp })
}
