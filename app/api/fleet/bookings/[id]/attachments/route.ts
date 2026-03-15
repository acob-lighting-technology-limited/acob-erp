import { NextResponse } from "next/server"
import { canManageFleet } from "@/lib/fleet-booking"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const bookingId = params.id

    const { data: booking, error: bookingError } = await dataClient
      .from("fleet_bookings")
      .select("id, requester_id")
      .eq("id", bookingId)
      .maybeSingle()

    if (bookingError) {
      return NextResponse.json({ error: "Failed to load booking" }, { status: 500 })
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const adminCanManage = await canManageFleet(supabase, user.id)
    if (!adminCanManage && booking.requester_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: attachments, error: attachmentError } = await dataClient
      .from("fleet_booking_attachments")
      .select("id, booking_id, file_name, file_path, mime_type, file_size, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true })

    if (attachmentError) {
      return NextResponse.json({ error: "Failed to load attachments" }, { status: 500 })
    }

    const rows = await Promise.all(
      (attachments || []).map(async (row: any) => {
        const { data } = await dataClient.storage.from("fleet_booking_documents").createSignedUrl(row.file_path, 900)
        return {
          ...row,
          signed_url: data?.signedUrl || null,
        }
      })
    )

    return NextResponse.json({ data: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
