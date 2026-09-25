import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getEventsSession, loadPendingRsvpCount } from "@/lib/events/server"

export const dynamic = "force-dynamic"
const log = logger("api-events-pending-rsvp")

export async function GET() {
  const session = await getEventsSession()
  if (!session) return NextResponse.json({ count: 0 }, { status: 401 })

  try {
    const count = await loadPendingRsvpCount(session)
    return NextResponse.json({ count })
  } catch (err) {
    log.error({ err }, "Failed to get pending RSVP count")
    return NextResponse.json({ error: "Failed to load pending RSVP count" }, { status: 500 })
  }
}
