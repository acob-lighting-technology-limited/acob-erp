import { NextRequest, NextResponse } from "next/server"
import { assertNoFleetOverlap, canManageFleet } from "@/lib/fleet-booking"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/audit/write-audit"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canManageFleet(supabase, user.id)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const bookingId = params.id
    const body = await request.json()
    const action = String(body?.action || "").toLowerCase()
    const adminNote = String(body?.admin_note || "").trim() || null

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await dataClient
      .from("fleet_bookings")
      .select("id, resource_id, start_at, end_at, status")
      .eq("id", bookingId)
      .maybeSingle()

    if (bookingError) return NextResponse.json({ error: "Failed to load booking" }, { status: 500 })
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    if (booking.status !== "pending") {
      return NextResponse.json({ error: "Only pending bookings can be reviewed" }, { status: 400 })
    }

    if (action === "approve") {
      await assertNoFleetOverlap({
        supabase: dataClient,
        resourceId: booking.resource_id,
        startAt: booking.start_at,
        endAt: booking.end_at,
        excludeBookingId: booking.id,
      })
    }

    const nextStatus = action === "approve" ? "approved" : "rejected"

    const { data, error } = await dataClient
      .from("fleet_bookings")
      .update({
        status: nextStatus,
        admin_note: adminNote,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .select("id, status, admin_note, reviewed_by, reviewed_at")
      .single()

    if (error) return NextResponse.json({ error: error.message || "Failed to review booking" }, { status: 500 })

    await writeAuditLog(
      supabase,
      {
        action: action === "approve" ? "approve" : "reject",
        entityType: "fleet_booking",
        entityId: bookingId,
        newValues: { status: nextStatus, admin_note: adminNote },
        context: { actorId: user.id, source: "api", route: `/api/admin/hr/fleet/bookings/${bookingId}/review` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message.toLowerCase().includes("overlap") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
