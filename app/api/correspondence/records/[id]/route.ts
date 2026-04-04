import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  CORRESPONDENCE_STATUSES,
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessRecord,
  getAuthContext,
} from "@/lib/correspondence/server"
import { logger } from "@/lib/logger"

const log = logger("correspondence-records")

const UpdateCorrespondenceRecordSchema = z.object({
  status: z.enum(CORRESPONDENCE_STATUSES as [string, ...string[]]).optional(),
  letter_type: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  subject: z.string().optional(),
  recipient_name: z.string().optional().nullable(),
  sender_name: z.string().optional().nullable(),
  action_required: z.boolean().optional(),
  due_date: z.string().optional().nullable(),
  responsible_officer_id: z.string().optional().nullable(),
  assigned_department_name: z.string().optional().nullable(),
  source_mode: z.string().optional().nullable(),
  metadata: z.unknown().optional().nullable(),
  is_locked: z.boolean().optional(),
  current_version: z.coerce.number().optional(),
  version_file_path: z.string().optional().nullable(),
  change_summary: z.string().optional().nullable(),
})

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
    log.error({ err: String(error) }, "Error in GET /api/correspondence/records/[id]:")
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
    const parsed = UpdateCorrespondenceRecordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const nextStatus = parsed.data.status ? String(parsed.data.status) : null
    const shouldCreateVersion = Boolean(parsed.data.version_file_path || parsed.data.change_summary)

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
      if (key in parsed.data) {
        updatePayload[key] = parsed.data[key as keyof typeof parsed.data]
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
        file_path: parsed.data.version_file_path ? String(parsed.data.version_file_path).trim() : null,
        change_summary: parsed.data.change_summary ? String(parsed.data.change_summary).trim() : null,
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

    const auditAction = nextStatus && nextStatus !== record.status ? "status_change" : "update"

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: auditAction,
      recordId: record.id,
      department: record.department_name || record.assigned_department_name || null,
      route: "/api/correspondence/records/[id]",
      critical: Boolean(nextStatus && nextStatus !== record.status),
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
    log.error({ err: String(error) }, "Error in PATCH /api/correspondence/records/[id]:")
    return NextResponse.json({ error: "Failed to update correspondence record" }, { status: 500 })
  }
}
