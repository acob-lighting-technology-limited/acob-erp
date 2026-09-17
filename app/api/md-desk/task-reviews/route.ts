import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getEventsSession } from "@/lib/events/server"
import { loadMdDeskAccess, loadMdTaskReviews } from "@/lib/md-desk/server"

export const dynamic = "force-dynamic"
const log = logger("api-md-desk-task-reviews")

// MD's Desk → Task Reviews. Lists only; rating goes through
// PATCH /api/tasks/[id]/status, which enforces reviewer rights itself.
export async function GET() {
  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const access = await loadMdDeskAccess(session)
  if (!access.canView) {
    return NextResponse.json({ error: "MD's Desk is limited to the MD and delegates" }, { status: 403 })
  }

  try {
    return NextResponse.json(await loadMdTaskReviews(session))
  } catch (err) {
    log.error({ err }, "Failed to load MD task reviews")
    return NextResponse.json({ error: "Failed to load task reviews" }, { status: 500 })
  }
}
