import { NextRequest, NextResponse } from "next/server"
import { canManageFleet } from "@/lib/fleet-booking"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canManageFleet(supabase, user.id)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const statusParam = request.nextUrl.searchParams.get("status")

    let query = dataClient
      .from("fleet_bookings")
      .select(
        `
        id,
        resource_id,
        requester_id,
        start_at,
        end_at,
        reason,
        status,
        admin_note,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        resource:fleet_resources(id, name, resource_type),
        requester:profiles!fleet_bookings_requester_id_fkey(id, full_name, company_email),
        reviewer:profiles!fleet_bookings_reviewed_by_fkey(id, full_name)
      `
      )
      .order("start_at", { ascending: false })

    if (statusParam) {
      query = query.eq("status", statusParam)
    }

    const { data: bookings, error } = await query
    if (error) return NextResponse.json({ error: error.message || "Failed to load bookings" }, { status: 500 })

    const bookingIds = (bookings || []).map((row: any) => row.id)
    let attachmentRows: any[] = []
    if (bookingIds.length > 0) {
      const { data: attachments } = await dataClient
        .from("fleet_booking_attachments")
        .select("id, booking_id, file_name, mime_type, file_size, file_path, created_at")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: true })
      attachmentRows = attachments || []
    }

    const attachmentCounts = new Map<string, number>()
    for (const attachment of attachmentRows) {
      attachmentCounts.set(attachment.booking_id, (attachmentCounts.get(attachment.booking_id) || 0) + 1)
    }

    const data = (bookings || []).map((booking: any) => ({
      ...booking,
      attachment_count: attachmentCounts.get(booking.id) || 0,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
