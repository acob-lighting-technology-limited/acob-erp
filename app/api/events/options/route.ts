import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getEventsSession, loadEventOptions } from "@/lib/events/server"

export const dynamic = "force-dynamic"
const log = logger("api-events-options")

// Form options plus what the caller may do. The staff list is only returned to
// people who can create events; capabilities come from the database helpers
// that the RLS policies themselves use, so the UI and the rules cannot disagree.
export async function GET() {
  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    return NextResponse.json(await loadEventOptions(session))
  } catch (err) {
    log.error({ err }, "Failed to load event options")
    return NextResponse.json({ error: "Failed to load event options" }, { status: 500 })
  }
}
