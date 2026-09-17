import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getEventsSession } from "@/lib/events/server"
import { loadMdDeskAccess, loadWaitingOnMd } from "@/lib/md-desk/server"

export const dynamic = "force-dynamic"
const log = logger("api-md-desk-overview")

// MD's Desk overview: the caller's desk access plus everything waiting on the
// MD's decision. The MD, delegates, super admins and developers get the queue.
export async function GET() {
  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const access = await loadMdDeskAccess(session)
  if (!access.canView)
    return NextResponse.json({ error: "MD's Desk is limited to the MD and delegates" }, { status: 403 })

  try {
    const queue = await loadWaitingOnMd(session)
    return NextResponse.json({ access, queue })
  } catch (err) {
    log.error({ err }, "Failed to load MD's Desk overview")
    return NextResponse.json({ error: "Failed to load MD's Desk" }, { status: 500 })
  }
}
