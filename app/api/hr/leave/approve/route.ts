import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import {
  areRequiredDocumentsVerified,
  getLeavePolicy,
  notifyUsers,
  syncAttendanceForApprovedLeave,
} from "@/lib/hr/leave-workflow"
import { getRouteStageByOrder, stageCodeForRole } from "@/lib/hr/leave-routing"
import { logger } from "@/lib/logger"

const log = logger("hr-leave-approve")

function normalizeAction(body: { action?: string; status?: string }) {
  if (body.action === "approve" || body.status === "approved") return "approved"
  if (body.action === "reject" || body.status === "rejected") return "rejected"
  return null
}

function inferCurrentStageCode(leaveRequest: any) {
  return leaveRequest.current_stage_code || leaveRequest.approval_stage
}

function toWorkflowRejectionStage(stageCode: string) {
  if (stageCode === stageCodeForRole("reliever")) return "reliever"
  if (stageCode === stageCodeForRole("department_lead")) return "supervisor"
  return "hr"
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`leave-approve:${getClientId(request)}`, { limit: 30, windowSec: 600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabaseAdmin =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : supabase

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
    const isHRAdmin = ["developer", "admin", "super_admin"].includes(actorProfile?.role)

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

    const stageCode = inferCurrentStageCode(leaveRequest)
    const snapshot = Array.isArray(leaveRequest.route_snapshot) ? leaveRequest.route_snapshot : []

    const currentStageOrder = Number(leaveRequest.current_stage_order || 1)
    const currentStage = getRouteStageByOrder(snapshot, currentStageOrder)

    const expectedApproverId = leaveRequest.current_approver_user_id || currentStage?.approver_user_id
    if (!expectedApproverId) {
      return NextResponse.json({ error: "LEAVE_APPROVER_NOT_CONFIGURED:current_stage" }, { status: 400 })
    }

    if (expectedApproverId !== user.id) {
      return NextResponse.json({ error: "LEAVE_STAGE_NOT_ASSIGNED_TO_ACTOR" }, { status: 403 })
    }

    if (leaveRequest.status === "pending_evidence" && action === "approved" && !isHRAdmin) {
      return NextResponse.json({ error: "Request is awaiting evidence verification before approval." }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (action === "rejected") {
      const { error: updateError } = await supabaseAdmin
        .from("leave_requests")
        .update({
          status: "rejected",
          approval_stage: "rejected",
          current_stage_code: "rejected",
          rejected_reason: comments,
          workflow_rejection_stage: toWorkflowRejectionStage(stageCode),
          reliever_decision_at: stageCode === stageCodeForRole("reliever") ? now : leaveRequest.reliever_decision_at,
          supervisor_decision_at:
            stageCode === stageCodeForRole("department_lead") ? now : leaveRequest.supervisor_decision_at,
          hr_decision_at:
            stageCode === stageCodeForRole("admin_hr_lead") || stageCode === stageCodeForRole("hcs")
              ? now
              : leaveRequest.hr_decision_at,
        })
        .eq("id", leave_request_id)

      if (updateError) {
        return NextResponse.json({ error: `Failed to reject leave request: ${updateError.message}` }, { status: 500 })
      }

      const { error: rejectionAuditError } = await supabaseAdmin.from("leave_approvals").upsert(
        {
          leave_request_id,
          approver_id: user.id,
          approval_level: currentStageOrder,
          status: action,
          comments: comments || null,
          approved_at: now,
          stage_code: stageCode,
          stage_order: currentStageOrder,
          reliever_revision: leaveRequest.reliever_revision || 1,
          superseded: false,
        },
        { onConflict: "leave_request_id,approver_id,approval_level" }
      )
      if (rejectionAuditError) {
        return NextResponse.json(
          { error: `Failed to record rejection audit: ${rejectionAuditError.message}` },
          { status: 500 }
        )
      }

      await notifyUsers(supabaseAdmin, {
        userIds: [leaveRequest.user_id],
        title: "Leave request rejected",
        message: `Your leave request was rejected at ${stageCode.replaceAll("_", " ")}. Reason: ${comments}`,
        actorId: user.id,
        linkUrl: "/dashboard/leave",
        entityId: leave_request_id,
        emailEvent: "rejected",
      })

      return NextResponse.json({ message: "Leave request rejected" })
    }

    // Approval history row
    const { error: approvalAuditError } = await supabaseAdmin.from("leave_approvals").upsert(
      {
        leave_request_id,
        approver_id: user.id,
        approval_level: currentStageOrder,
        status: action,
        comments: comments || null,
        approved_at: now,
        stage_code: stageCode,
        stage_order: currentStageOrder,
        reliever_revision: leaveRequest.reliever_revision || 1,
        superseded: false,
      },
      { onConflict: "leave_request_id,approver_id,approval_level" }
    )
    if (approvalAuditError) {
      return NextResponse.json(
        { error: `Failed to record approval audit: ${approvalAuditError.message}` },
        { status: 500 }
      )
    }

    const nextStageOrder = currentStageOrder + 1
    const nextStage = getRouteStageByOrder(snapshot, nextStageOrder)

    if (!nextStage) {
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

      const { error: updateError } = await supabaseAdmin
        .from("leave_requests")
        .update({
          status: "approved",
          approval_stage: "completed",
          current_stage_code: "completed",
          approved_by: user.id,
          approved_at: now,
          hr_decision_at: now,
          hr_comment: comments || null,
          lead_reconfirm_required: false,
        })
        .eq("id", leave_request_id)

      if (updateError) {
        return NextResponse.json({ error: `Failed to approve leave request: ${updateError.message}` }, { status: 500 })
      }

      await supabaseAdmin.rpc("update_leave_balance", {
        p_user_id: leaveRequest.user_id,
        p_leave_type_id: leaveRequest.leave_type_id,
        p_days: leaveRequest.days_count,
      })

      await syncAttendanceForApprovedLeave(
        supabaseAdmin,
        leaveRequest.user_id,
        leaveRequest.start_date,
        leaveRequest.end_date,
        "set"
      )

      await notifyUsers(supabaseAdmin, {
        userIds: [leaveRequest.user_id],
        title: "Leave approved - proceed on leave",
        message: `Your leave has been approved. Start: ${leaveRequest.start_date}, Resume: ${leaveRequest.resume_date}.`,
        actorId: user.id,
        linkUrl: "/dashboard/leave",
        entityId: leave_request_id,
        emailEvent: "approved",
      })

      return NextResponse.json({ message: "Final approval recorded and leave approved" })
    }

    if (!nextStage.approver_user_id) {
      return NextResponse.json({ error: "LEAVE_APPROVER_NOT_CONFIGURED:next_stage_approver" }, { status: 400 })
    }

    const transitionUpdates: Record<string, unknown> = {
      approval_stage: nextStage.stage_code,
      current_stage_code: nextStage.stage_code,
      current_stage_order: nextStage.stage_order,
      current_approver_user_id: nextStage.approver_user_id,
      lead_reconfirm_required:
        stageCode === stageCodeForRole("department_lead") ? false : leaveRequest.lead_reconfirm_required,
    }

    if (stageCode === stageCodeForRole("reliever")) {
      transitionUpdates.reliever_decision_at = now
      transitionUpdates.reliever_comment = comments || null
    }

    if (stageCode === stageCodeForRole("department_lead")) {
      transitionUpdates.supervisor_decision_at = now
      transitionUpdates.supervisor_comment = comments || null
    }

    if (stageCode === stageCodeForRole("admin_hr_lead") || stageCode === stageCodeForRole("hcs")) {
      transitionUpdates.hr_decision_at = now
      transitionUpdates.hr_comment = comments || null
    }

    const { error: updateError } = await supabaseAdmin
      .from("leave_requests")
      .update(transitionUpdates)
      .eq("id", leave_request_id)
    if (updateError) {
      return NextResponse.json({ error: `Failed to advance leave request: ${updateError.message}` }, { status: 500 })
    }

    await notifyUsers(supabaseAdmin, {
      userIds: [nextStage.approver_user_id],
      title: "Leave request awaiting your approval",
      message: `A leave request is now waiting at ${nextStage.stage_code.replaceAll("_", " ")}.`,
      actorId: user.id,
      linkUrl: "/dashboard/leave",
      entityId: leave_request_id,
      emailEvent: "approval_required",
    })

    return NextResponse.json({ message: "Approval recorded" })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/hr/leave/approve:")
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
  }
}
