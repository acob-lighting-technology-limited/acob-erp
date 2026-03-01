import { NextRequest, NextResponse } from "next/server"
import {
  CORRESPONDENCE_STATUSES,
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessRecord,
  getAuthContext,
} from "@/lib/correspondence/server"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: record, error } = await supabase
      .from("correspondence_records")
      .select("*")
      .eq("id", params.id)
      .single()

    if (error || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    if (!canAccessRecord(profile, user.id, record)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [{ data: approvals }, { data: events }, { data: versions }] = await Promise.all([
      supabase
        .from("correspondence_approvals")
        .select("*")
        .eq("correspondence_id", params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("correspondence_events")
        .select("*")
        .eq("correspondence_id", params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("correspondence_versions")
        .select("*")
        .eq("correspondence_id", params.id)
        .order("version_no", { ascending: false }),
    ])

    return NextResponse.json({
      data: { record, approvals: approvals || [], events: events || [], versions: versions || [] },
    })
  } catch (error) {
    console.error("Error in GET /api/correspondence/records/[id]:", error)
    return NextResponse.json({ error: "Failed to fetch record details" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: record, error } = await supabase
      .from("correspondence_records")
      .select("*")
      .eq("id", params.id)
      .single()

    if (error || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    if (!canAccessRecord(profile, user.id, record)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const nextStatus = body?.status ? String(body.status) : null
    const shouldCreateVersion = Boolean(body?.version_file_path || body?.change_summary)

    if (nextStatus && !CORRESPONDENCE_STATUSES.includes(nextStatus as any)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const allowedFields = [
      "status",
      "letter_type",
      "category",
      "subject",
      "recipient_name",
      "sender_name",
      "action_required",
      "due_date",
      "responsible_officer_id",
      "assigned_department_name",
      "source_mode",
      "metadata",
      "is_locked",
      "current_version",
    ]

    const updatePayload: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in body) {
        updatePayload[key] = body[key]
      }
    }

    if (shouldCreateVersion && !("current_version" in updatePayload)) {
      updatePayload.current_version = Number(record.current_version || 1) + 1
    }

    if (nextStatus === "approved") {
      updatePayload.approved_at = new Date().toISOString()
    }

    const { data: updated, error: updateError } = await supabase
      .from("correspondence_records")
      .update(updatePayload)
      .eq("id", params.id)
      .select("*")
      .single()

    if (updateError) throw updateError

    if (shouldCreateVersion) {
      await supabase.from("correspondence_versions").insert({
        correspondence_id: record.id,
        version_no: updated.current_version,
        file_path: body?.version_file_path ? String(body.version_file_path).trim() : null,
        change_summary: body?.change_summary ? String(body.change_summary).trim() : null,
        uploaded_by: user.id,
      })
    }

    if (nextStatus && nextStatus !== record.status) {
      await appendCorrespondenceEvent({
        correspondenceId: record.id,
        actorId: user.id,
        eventType: "status_changed",
        oldStatus: record.status,
        newStatus: nextStatus,
        details: {
          previous_status: record.status,
          updated_status: nextStatus,
        },
      })
    } else {
      await appendCorrespondenceEvent({
        correspondenceId: record.id,
        actorId: user.id,
        eventType: "record_updated",
        oldStatus: record.status,
        newStatus: updated.status,
        details: {
          changed_fields: Object.keys(updatePayload),
        },
      })
    }

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: "correspondence_record_updated",
      recordId: record.id,
      oldValues: {
        status: record.status,
        is_locked: record.is_locked,
      },
      newValues: {
        status: updated.status,
        is_locked: updated.is_locked,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error in PATCH /api/correspondence/records/[id]:", error)
    return NextResponse.json({ error: "Failed to update correspondence record" }, { status: 500 })
  }
}
