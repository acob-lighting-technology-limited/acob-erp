import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessDepartment,
  canAccessRecord,
  getAuthContext,
} from "@/lib/correspondence/server"
import { logger } from "@/lib/logger"
import { normalizeDepartmentName } from "@/shared/departments"

const log = logger("correspondence-records-approvals")

const CreateCorrespondenceApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected", "returned_for_correction"], {
    errorMap: () => ({ message: "decision must be one of approved, rejected, returned_for_correction" }),
  }),
  comments: z.string().optional().nullable(),
})

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
    const parsed = CreateCorrespondenceApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }

    const decision = parsed.data.decision
    const comments = parsed.data.comments ? String(parsed.data.comments).trim() : null

    const approvalScopeDepartment = String(record.department_name || record.assigned_department_name || "")
    const normalizedScopeDepartment = normalizeDepartmentName(approvalScopeDepartment)
    const designation = String((profile as { designation?: string | null })?.designation || "").toLowerCase()
    const role = String(profile.role || "").toLowerCase()
    const isManagingDirector =
      role === "super_admin" || designation.includes("managing director") || designation === "md"
    const isExecutiveLead =
      Boolean(profile.is_department_lead) &&
      normalizedScopeDepartment === normalizeDepartmentName("Executive Management") &&
      canAccessDepartment(profile, "Executive Management")
    const isApprover = isManagingDirector || isExecutiveLead

    if (!isApprover) {
      return NextResponse.json(
        { error: "Only Managing Director or Executive Management lead can approve correspondence" },
        { status: 403 }
      )
    }

    const { data: pendingApprovals, error: approvalError } = await supabase
      .from("correspondence_approvals")
      .select("*")
      .eq("correspondence_id", record.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })

    if (approvalError) throw approvalError

    let targetApproval = pendingApprovals?.[0]

    if (!targetApproval) {
      const { data: inserted, error: insertError } = await supabase
        .from("correspondence_approvals")
        .insert({
          correspondence_id: record.id,
          approval_stage: "department_review",
          approver_id: user.id,
          status: decision,
          comments,
          decided_at: new Date().toISOString(),
        })
        .select("*")
        .single()

      if (insertError) throw insertError
      targetApproval = inserted
    } else {
      const { data: updatedApproval, error: updateApprovalError } = await supabase
        .from("correspondence_approvals")
        .update({
          approver_id: user.id,
          status: decision,
          comments,
          decided_at: new Date().toISOString(),
        })
        .eq("id", targetApproval.id)
        .select("*")
        .single()

      if (updateApprovalError) throw updateApprovalError
      targetApproval = updatedApproval
    }

    const nextRecordStatus =
      decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "returned_for_correction"

    const { data: updatedRecord, error: recordUpdateError } = await supabase
      .from("correspondence_records")
      .update({
        status: nextRecordStatus,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", record.id)
      .select("*")
      .single()

    if (recordUpdateError) throw recordUpdateError

    await appendCorrespondenceEvent({
      correspondenceId: record.id,
      actorId: user.id,
      eventType: "approval_decision",
      oldStatus: record.status,
      newStatus: nextRecordStatus,
      details: {
        decision,
        approval_stage: targetApproval.approval_stage,
        comments,
      },
    })

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: `correspondence_approval_${decision}`,
      recordId: record.id,
      department: approvalScopeDepartment || null,
      route: "/api/correspondence/records/[id]/approvals",
      critical: true,
      oldValues: { status: record.status },
      newValues: { status: updatedRecord.status, decision },
    })

    try {
      await supabase.rpc("create_notification", {
        p_user_id: record.originator_id,
        p_type: decision === "approved" ? "approval" : "warning",
        p_category: "operations",
        p_title: `Correspondence ${decision}`,
        p_message: `${record.reference_number} was marked ${decision}`,
        p_priority: decision === "rejected" ? "high" : "normal",
        p_link_url: "/correspondence",
        p_actor_id: user.id,
        p_entity_type: "correspondence_record",
        p_entity_id: record.id,
        p_rich_content: { decision, reference_number: record.reference_number },
      })
    } catch (notifyError) {
      log.error({ err: String(notifyError) }, "Correspondence approval notification error:")
    }

    return NextResponse.json({ data: { record: updatedRecord, approval: targetApproval } })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/correspondence/records/[id]/approvals:")
    return NextResponse.json({ error: "Failed to process approval" }, { status: 500 })
  }
}

// POST kept for backwards compat — prefer PATCH
export { POST as PATCH }
