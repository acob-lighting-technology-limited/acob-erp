import { NextRequest, NextResponse } from "next/server"
import {
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessRecord,
  getAuthContext,
} from "@/lib/correspondence/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: record, error: recordError } = await supabase
      .from("correspondence_records")
      .select("*")
      .eq("id", params.id)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    if (!canAccessRecord(profile, user.id, record)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const incomingReferenceId = String(body?.incoming_reference_id || "").trim()

    if (!incomingReferenceId) {
      return NextResponse.json({ error: "incoming_reference_id is required" }, { status: 400 })
    }

    const { data: incomingRecord, error: incomingError } = await supabase
      .from("correspondence_records")
      .select("id, reference_number, direction")
      .eq("id", incomingReferenceId)
      .single()

    if (incomingError || !incomingRecord) {
      return NextResponse.json({ error: "Incoming reference record not found" }, { status: 404 })
    }

    if (incomingRecord.direction !== "incoming") {
      return NextResponse.json(
        { error: "incoming_reference_id must point to an incoming correspondence record" },
        { status: 400 }
      )
    }

    const { data: updatedRecord, error: updateError } = await supabase
      .from("correspondence_records")
      .update({
        incoming_reference_id: incomingRecord.id,
      })
      .eq("id", record.id)
      .select("*")
      .single()

    if (updateError) throw updateError

    await appendCorrespondenceEvent({
      correspondenceId: record.id,
      actorId: user.id,
      eventType: "linked_incoming_reference",
      oldStatus: record.status,
      newStatus: updatedRecord.status,
      details: {
        incoming_reference_id: incomingRecord.id,
        incoming_reference_number: incomingRecord.reference_number,
      },
    })

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: "correspondence_record_linked_incoming",
      recordId: record.id,
      oldValues: { incoming_reference_id: record.incoming_reference_id },
      newValues: { incoming_reference_id: incomingRecord.id },
    })

    return NextResponse.json({ data: updatedRecord })
  } catch (error) {
    console.error("Error in POST /api/correspondence/records/[id]/link-response:", error)
    return NextResponse.json({ error: "Failed to link incoming reference" }, { status: 500 })
  }
}
