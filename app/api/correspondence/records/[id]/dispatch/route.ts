import { NextRequest, NextResponse } from "next/server"
import {
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessRecord,
  getAuthContext,
  isAdminRole,
} from "@/lib/correspondence/server"

const FINAL_STATUSES = ["sent", "filed"]
const DISPATCH_METHODS = ["email", "courier", "hand_delivery", "regulatory_portal"]

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

    if (!isAdminRole(profile.role) && record.originator_id !== user.id && record.responsible_officer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const finalStatus = String(body?.final_status || "").toLowerCase()
    const dispatchMethod = String(body?.dispatch_method || "").toLowerCase()

    if (!FINAL_STATUSES.includes(finalStatus)) {
      return NextResponse.json({ error: "final_status must be sent or filed" }, { status: 400 })
    }

    if (!DISPATCH_METHODS.includes(dispatchMethod)) {
      return NextResponse.json({ error: "Invalid dispatch_method" }, { status: 400 })
    }

    const { data: updatedRecord, error: updateError } = await supabase
      .from("correspondence_records")
      .update({
        status: finalStatus,
        dispatch_method: dispatchMethod,
        proof_of_delivery_path: body?.proof_of_delivery_path ? String(body.proof_of_delivery_path).trim() : null,
        recipient_name: body?.recipient_name ? String(body.recipient_name).trim() : record.recipient_name,
        sent_at: new Date().toISOString(),
        is_locked: true,
      })
      .eq("id", record.id)
      .select("*")
      .single()

    if (updateError) throw updateError

    await appendCorrespondenceEvent({
      correspondenceId: record.id,
      actorId: user.id,
      eventType: "dispatched",
      oldStatus: record.status,
      newStatus: finalStatus,
      details: {
        dispatch_method: dispatchMethod,
        proof_of_delivery_path: body?.proof_of_delivery_path || null,
      },
    })

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: "correspondence_record_dispatched",
      recordId: record.id,
      oldValues: {
        status: record.status,
        is_locked: record.is_locked,
      },
      newValues: {
        status: updatedRecord.status,
        dispatch_method: updatedRecord.dispatch_method,
        is_locked: updatedRecord.is_locked,
      },
    })

    return NextResponse.json({ data: updatedRecord })
  } catch (error) {
    console.error("Error in POST /api/correspondence/records/[id]/dispatch:", error)
    return NextResponse.json({ error: "Failed to finalize dispatch" }, { status: 500 })
  }
}
