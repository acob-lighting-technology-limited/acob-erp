import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { canManageFleet } from "@/lib/fleet-booking"
import { archiveFleetBookingToSharePoint, sweepFleetBookingsForArchive } from "@/lib/fleet/archive"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/fleet/archive
 * Admin-only: archives attachments from approved/completed fleet bookings to SharePoint.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`fleet-archive:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allowed = await canManageFleet(supabase, user.id)
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden: fleet admin access required" }, { status: 403 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const body = await request.json().catch(() => ({}))
  const bookingId = typeof body?.booking_id === "string" ? body.booking_id.trim() : null

  if (bookingId) {
    const result = await archiveFleetBookingToSharePoint(dataClient, bookingId)
    return NextResponse.json({ data: result })
  }

  const sweepResult = await sweepFleetBookingsForArchive(dataClient, 25)
  return NextResponse.json({ data: sweepResult })
}
