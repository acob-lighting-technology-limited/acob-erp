import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessRecord,
  getAuthContext,
  isAdminRole,
} from "@/lib/correspondence/server"
import { logger } from "@/lib/logger"

const log = logger("correspondence-records-dispatch")

const DispatchCorrespondenceSchema = z.object({
  final_status: z.enum(["sent", "filed"], {
    errorMap: () => ({ message: "final_status must be sent or filed" }),
  }),
  dispatch_method: z.enum(["email", "courier", "hand_delivery", "regulatory_portal"], {
    errorMap: () => ({ message: "Invalid dispatch_method" }),
  }),
  proof_of_delivery_path: z.string().optional().nullable(),
  recipient_name: z.string().optional().nullable(),
})

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
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
    const parsed = DispatchCorrespondenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const finalStatus = parsed.data.final_status
    const dispatchMethod = parsed.data.dispatch_method

    const { data: updatedRecord, error: updateError } = await supabase
      .from("correspondence_records")
      .update({
        status: finalStatus,
        dispatch_method: dispatchMethod,
        proof_of_delivery_path: parsed.data.proof_of_delivery_path
          ? String(parsed.data.proof_of_delivery_path).trim()
          : null,
        recipient_name: parsed.data.recipient_name ? String(parsed.data.recipient_name).trim() : record.recipient_name,
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
        proof_of_delivery_path: parsed.data.proof_of_delivery_path || null,
      },
    })

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: "correspondence_record_dispatched",
      recordId: record.id,
      department: record.department_name || record.assigned_department_name || null,
      route: "/api/correspondence/records/[id]/dispatch",
      critical: true,
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
    log.error({ err: String(error) }, "Error in PATCH /api/correspondence/records/[id]/dispatch:")
    return NextResponse.json({ error: "Failed to finalize dispatch" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export { PATCH as POST }
