import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getEventsSession, loadCalendarBadgeData } from "@/lib/events/server"

export const dynamic = "force-dynamic"
const log = logger("api-events-badge")

export async function GET() {
  const session = await getEventsSession()
  if (!session) return NextResponse.json({ upcomingEvents: [], pendingRsvpCount: 0 }, { status: 401 })

  try {
    const data = await loadCalendarBadgeData(session)
    return NextResponse.json(data)
  } catch (err) {
    log.error({ err }, "Failed to get calendar badge data")
    return NextResponse.json({ error: "Failed to load calendar badge data" }, { status: 500 })
  }
}
