import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  LEAVE_PENDING_STAGES,
  areRequiredDocumentsVerified,
  createApprovalRecord,
  getLeavePolicy,
  notifyUsers,
  syncAttendanceForApprovedLeave,
} from "@/lib/hr/leave-workflow"

function normalizeAction(body: { action?: string; status?: string }) {
  if (body.action === "approve" || body.status === "approved") return "approved"
  if (body.action === "reject" || body.status === "rejected") return "rejected"
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { leave_request_id, comments, override_evidence } = body
    const action = normalizeAction(body)

    if (!leave_request_id || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (action === "rejected" && !comments?.trim()) {
      return NextResponse.json({ error: "Comments are required when rejecting a leave request" }, { status: 400 })
    }

    const { data: actorProfile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single()

    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", leave_request_id)
      .single()

    if (fetchError || !leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    if (!["pending", "pending_evidence"].includes(leaveRequest.status)) {
      return NextResponse.json({ error: "Only active requests can be processed" }, { status: 400 })
    }

    const stage = leaveRequest.approval_stage || LEAVE_PENDING_STAGES.RELIEVER
    const isHR = ["admin", "super_admin"].includes(actorProfile?.role)

    if (leaveRequest.status === "pending_evidence" && !isHR) {
      return NextResponse.json({ error: "Request is awaiting evidence verification before approval." }, { status: 400 })
    }

    if (stage === LEAVE_PENDING_STAGES.RELIEVER && leaveRequest.reliever_id !== user.id) {
      return NextResponse.json({ error: "Only assigned reliever can process this stage" }, { status: 403 })
    }

    if (stage === LEAVE_PENDING_STAGES.SUPERVISOR && leaveRequest.supervisor_id !== user.id) {
      return NextResponse.json({ error: "Only assigned supervisor can process this stage" }, { status: 403 })
    }

    if (stage === LEAVE_PENDING_STAGES.HR && !isHR) {
      return NextResponse.json({ error: "Only HR can process this stage" }, { status: 403 })
    }

    const now = new Date().toISOString()

    if (action === "rejected") {
      const updates: Record<string, unknown> = {
        status: "rejected",
        approval_stage: "rejected",
        rejected_reason: comments,
        workflow_rejection_stage:
          stage === LEAVE_PENDING_STAGES.RELIEVER
            ? "reliever"
            : stage === LEAVE_PENDING_STAGES.SUPERVISOR
              ? "supervisor"
              : "hr",
      }

      if (stage === LEAVE_PENDING_STAGES.RELIEVER) {
        updates.reliever_decision_at = now
        updates.reliever_comment = comments
      }

      if (stage === LEAVE_PENDING_STAGES.SUPERVISOR) {
        updates.supervisor_decision_at = now
        updates.supervisor_comment = comments
      }

      if (stage === LEAVE_PENDING_STAGES.HR) {
        updates.hr_decision_at = now
        updates.hr_comment = comments
      }

      const { error: updateError } = await supabase.from("leave_requests").update(updates).eq("id", leave_request_id)
      if (updateError) return NextResponse.json({ error: "Failed to reject leave request" }, { status: 500 })

      await createApprovalRecord(supabase, {
        leaveRequestId: leave_request_id,
        approverId: user.id,
        stage,
        action,
        comments,
      })

      await notifyUsers(supabase, {
        userIds: [leaveRequest.user_id],
        title: "Leave request rejected",
        message: `Your leave request was rejected at ${stage.replace("_", " ")}. Reason: ${comments}`,
        actorId: user.id,
        linkUrl: "/dashboard/leave",
        entityId: leave_request_id,
      })

      return NextResponse.json({ message: "Leave request rejected" })
    }

    if (stage === LEAVE_PENDING_STAGES.RELIEVER) {
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          approval_stage: LEAVE_PENDING_STAGES.SUPERVISOR,
          reliever_decision_at: now,
          reliever_comment: comments || null,
        })
        .eq("id", leave_request_id)

      if (updateError) return NextResponse.json({ error: "Failed to advance leave request" }, { status: 500 })

      await createApprovalRecord(supabase, {
        leaveRequestId: leave_request_id,
        approverId: user.id,
        stage,
        action,
        comments,
      })

      await notifyUsers(supabase, {
        userIds: [leaveRequest.supervisor_id],
        title: "Leave request awaiting supervisor approval",
        message: "A leave request is now waiting for your supervisor approval action.",
        actorId: user.id,
        linkUrl: "/dashboard/leave",
        entityId: leave_request_id,
      })

      return NextResponse.json({ message: "Reliever approval recorded" })
    }

    if (stage === LEAVE_PENDING_STAGES.SUPERVISOR) {
      const { data: hrUsers } = await supabase.from("profiles").select("id").in("role", ["admin", "super_admin"])

      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          approval_stage: LEAVE_PENDING_STAGES.HR,
          supervisor_decision_at: now,
          supervisor_comment: comments || null,
        })
        .eq("id", leave_request_id)

      if (updateError) return NextResponse.json({ error: "Failed to advance leave request" }, { status: 500 })

      await createApprovalRecord(supabase, {
        leaveRequestId: leave_request_id,
        approverId: user.id,
        stage,
        action,
        comments,
      })

      await notifyUsers(supabase, {
        userIds: (hrUsers || []).map((row: { id: string }) => row.id),
        title: "Leave request awaiting HR endorsement",
        message: "A leave request is pending HR final endorsement.",
        actorId: user.id,
        linkUrl: "/admin/hr/leave/approve",
        entityId: leave_request_id,
      })

      return NextResponse.json({ message: "Supervisor approval recorded" })
    }

    if (stage === LEAVE_PENDING_STAGES.HR) {
      const policy = await getLeavePolicy(supabase, leaveRequest.leave_type_id)
      const requiredDocs = policy.required_documents || []
      const evidenceStatus = await areRequiredDocumentsVerified(supabase, leave_request_id, requiredDocs)

      if (!evidenceStatus.complete) {
        if (!override_evidence) {
          return NextResponse.json(
            {
              error: `Required evidence not complete. Missing: ${evidenceStatus.missing.join(", ")}`,
              missing_documents: evidenceStatus.missing,
            },
            { status: 400 }
          )
        }

        if (!policy.override_allowed) {
          return NextResponse.json({ error: "Policy does not allow evidence override" }, { status: 400 })
        }

        if (!comments?.trim()) {
          return NextResponse.json({ error: "Override reason is required" }, { status: 400 })
        }
      }

      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          approval_stage: "completed",
          approved_by: user.id,
          approved_at: now,
          hr_decision_at: now,
          hr_comment: comments || null,
        })
        .eq("id", leave_request_id)

      if (updateError) return NextResponse.json({ error: "Failed to approve leave request" }, { status: 500 })

      await createApprovalRecord(supabase, {
        leaveRequestId: leave_request_id,
        approverId: user.id,
        stage,
        action,
        comments,
      })

      await supabase.rpc("update_leave_balance", {
        p_user_id: leaveRequest.user_id,
        p_leave_type_id: leaveRequest.leave_type_id,
        p_days: leaveRequest.days_count,
      })

      await syncAttendanceForApprovedLeave(
        supabase,
        leaveRequest.user_id,
        leaveRequest.start_date,
        leaveRequest.end_date,
        "set"
      )

      await notifyUsers(supabase, {
        userIds: [leaveRequest.user_id],
        title: "Leave approved - proceed on leave",
        message: `Your leave has been approved. Start: ${leaveRequest.start_date}, Resume: ${leaveRequest.resume_date}.`,
        actorId: user.id,
        linkUrl: "/dashboard/leave",
        entityId: leave_request_id,
      })

      return NextResponse.json({ message: "HR endorsement recorded and leave approved" })
    }

    return NextResponse.json({ error: "Invalid approval stage" }, { status: 400 })
  } catch (error) {
    console.error("Error in POST /api/hr/leave/approve:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
  }
}
