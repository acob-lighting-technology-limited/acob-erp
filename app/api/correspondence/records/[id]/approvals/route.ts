import { NextRequest, NextResponse } from "next/server"
import {
  appendCorrespondenceAuditLog,
  appendCorrespondenceEvent,
  canAccessDepartment,
  canAccessRecord,
  getAuthContext,
  isAdminRole,
} from "@/lib/correspondence/server"

const APPROVAL_DECISIONS = ["approved", "rejected", "returned_for_correction"]

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
    const decision = String(body?.decision || "").toLowerCase()
    const comments = body?.comments ? String(body.comments).trim() : null

    if (!APPROVAL_DECISIONS.includes(decision)) {
      return NextResponse.json(
        { error: "decision must be one of approved, rejected, returned_for_correction" },
        { status: 400 }
      )
    }

    const approvalScopeDepartment = record.department_name || record.assigned_department_name
    const isApprover =
      isAdminRole(profile.role) ||
      (profile.role === "lead" && approvalScopeDepartment && canAccessDepartment(profile, approvalScopeDepartment))

    if (!isApprover) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
        p_link_url: "/portal/correspondence",
        p_actor_id: user.id,
        p_entity_type: "correspondence_record",
        p_entity_id: record.id,
        p_rich_content: { decision, reference_number: record.reference_number },
      })
    } catch (notifyError) {
      console.error("Correspondence approval notification error:", notifyError)
    }

    return NextResponse.json({ data: { record: updatedRecord, approval: targetApproval } })
  } catch (error) {
    console.error("Error in POST /api/correspondence/records/[id]/approvals:", error)
    return NextResponse.json({ error: "Failed to process approval" }, { status: 500 })
  }
}
