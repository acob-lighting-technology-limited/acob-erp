/** PATCH /api/hr/leave/requests (split from route.ts, audit 5.10). */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import {
  assertNoOverlap,
  assertRelieverAvailability,
  evaluateLeaveEligibility,
  formatLeaveReference,
  getLeavePolicy,
  getLeaveRequestSegments,
  getNextBusinessDate,
  parseISODate,
  resolveProfileByIdentifier,
} from "@/lib/hr/leave-workflow"
import { getRemainingDays } from "@/lib/hr/leave-entitlement"
import {
  buildResolvedRouteSnapshot,
  classifyRequesterKind,
  getRouteStageByOrder,
  notifyStageApprover,
  stageCodeForRole,
} from "@/lib/hr/leave-routing"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import {
  log,
  UpdateLeaveRequestSchema,
  resolveSegments,
  resolveSegmentsWithHolidays,
  isRelieverStage,
  assertNoDepartmentOverlap,
  assertRequesterNotBlockedByRelieverCommitment,
  canRequesterModifyBeforeRelieverDecision,
  getUserDepartmentId,
  assertSameDepartmentReliever,
  assertBlackoutWindowAllowed,
} from "./shared"

export async function PATCH(request: NextRequest) {
  const rl = await rateLimit(`hr-leave-requests:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed)
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    )
  try {
    const supabase = await createClient()
    const validationClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = UpdateLeaveRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const {
      id,
      leave_type_id,
      segments: rawSegments,
      emergency_override,
      reason,
      reliever_identifier,
      handover_note,
      handover_checklist_url,
    } = parsed.data

    const { data: existingRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Lead-stage reliever reassignment workflow (reset to reliever)
    if (
      reliever_identifier &&
      existingRequest.status === "pending" &&
      (existingRequest.current_stage_code === stageCodeForRole("department_lead") ||
        existingRequest.approval_stage === stageCodeForRole("department_lead")) &&
      existingRequest.current_approver_user_id === user.id
    ) {
      const newReliever = await resolveProfileByIdentifier(validationClient, reliever_identifier, "Reliever")
      const requesterDepartmentId = await getUserDepartmentId(supabase, existingRequest.user_id)

      if (!newReliever?.id || newReliever.id === existingRequest.user_id) {
        return NextResponse.json({ error: "Invalid reliever selected" }, { status: 400 })
      }
      assertSameDepartmentReliever({
        requesterDepartmentId,
        relieverDepartmentId: newReliever.department_id,
      })

      await assertRelieverAvailability(
        validationClient,
        newReliever.id,
        existingRequest.start_date,
        existingRequest.end_date,
        existingRequest.id
      )

      const routeSnapshot = Array.isArray(existingRequest.route_snapshot) ? [...existingRequest.route_snapshot] : []
      const updatedSnapshot = routeSnapshot.map((stage) => {
        if (Number(stage.stage_order) === 1 && stage.approver_role_code === "reliever") {
          return { ...stage, approver_user_id: newReliever.id }
        }
        return stage
      })

      const newRevision = Number(existingRequest.reliever_revision || 1) + 1

      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          reliever_id: newReliever.id,
          route_snapshot: updatedSnapshot,
          current_stage_order: 1,
          current_stage_code: stageCodeForRole("reliever"),
          current_approver_user_id: newReliever.id,
          approval_stage: stageCodeForRole("reliever"),
          reliever_revision: newRevision,
          lead_reconfirm_required: true,
        })
        .eq("id", existingRequest.id)

      if (updateError) {
        return NextResponse.json({ error: "Failed to update reliever" }, { status: 500 })
      }

      await supabase
        .from("leave_approvals")
        .update({ superseded: true })
        .eq("leave_request_id", existingRequest.id)
        .eq("stage_code", stageCodeForRole("reliever"))
        .eq("superseded", false)

      const { data: reqProfile } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name, company_email, department")
        .eq("id", existingRequest.user_id)
        .maybeSingle()
      const reqName =
        reqProfile?.full_name ||
        `${reqProfile?.first_name || ""} ${reqProfile?.last_name || ""}`.trim() ||
        reqProfile?.company_email ||
        "Employee"
      const { data: ltRow } = await supabase
        .from("leave_types")
        .select("id, name")
        .eq("id", existingRequest.leave_type_id)
        .maybeSingle()
      const ltName = ltRow?.name || "Leave"
      const ref = formatLeaveReference(existingRequest.id)
      const refSuffix = ref ? ` — ${ref}` : ""

      await notifyStageApprover({
        supabase,
        approverUserId: newReliever.id,
        title: "Leave relief confirmation required",
        message: `${reqName} has designated you as reliever for ${ltName} (${existingRequest.days_count} day(s), ${existingRequest.start_date} to ${existingRequest.end_date}). Review the handover note and confirm coverage so the workflow can proceed.`,
        actorId: user.id,
        entityId: existingRequest.id,
        linkUrl: "/hr/leave",
        emailSubject: `Action Required: Leave Relief Reassigned to You — ${reqName}${refSuffix}`,
        emailTitle: "Leave Relief Confirmation Required",
        badgeText: "Relief Required",
        detailsTitle: "Leave Request Details",
        details: [
          { label: "Employee", value: reqName },
          { label: "Department", value: reqProfile?.department || "-" },
          { label: "Leave Type", value: ltName },
          { label: "Duration", value: `${existingRequest.days_count} day(s)` },
          { label: "Period", value: `${existingRequest.start_date} to ${existingRequest.end_date}` },
          { label: "Resumption Date", value: existingRequest.resume_date || "-" },
          ...(existingRequest.handover_note ? [{ label: "Handover Note", value: existingRequest.handover_note }] : []),
        ],
        ctaLabel: "Review & Confirm Relief",
      })

      return NextResponse.json({ message: "Reliever updated and request returned to reliever approval" })
    }

    // Requester self-edit allowed only while still at reliever stage
    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own leave requests" }, { status: 403 })
    }

    const canModify = await canRequesterModifyBeforeRelieverDecision(supabase, existingRequest)
    if (!canModify) {
      return NextResponse.json({ error: "You can only edit requests pending reliever review" }, { status: 400 })
    }

    const targetLeaveTypeId = leave_type_id || existingRequest.leave_type_id

    let targetSegments: ReturnType<typeof resolveSegments>
    try {
      const segmentsToResolve =
        rawSegments ||
        (await getLeaveRequestSegments(validationClient, id, existingRequest.start_date, existingRequest.end_date))
      targetSegments = (await resolveSegmentsWithHolidays(validationClient, segmentsToResolve)).resolved
    } catch (segmentError) {
      return NextResponse.json(
        { error: segmentError instanceof Error ? segmentError.message : "Invalid date ranges" },
        { status: 400 }
      )
    }
    const targetStartDate = targetSegments.startDate
    const targetDays = targetSegments.totalDays

    const { data: requester } = await supabase
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, company_email, department, department_id, is_department_lead, lead_departments, gender, employment_date, work_location, employment_type, marital_status, has_children, pregnancy_status"
      )
      .eq("id", user.id)
      .single()

    if (!requester) {
      return NextResponse.json({ error: "Failed to load employee profile" }, { status: 400 })
    }

    const { data: leaveType } = await supabase
      .from("leave_types")
      .select("id, name, code, max_days")
      .eq("id", targetLeaveTypeId)
      .single()

    if (!leaveType) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 400 })
    }

    const policy = await getLeavePolicy(supabase, targetLeaveTypeId)
    const eligibility = await evaluateLeaveEligibility({
      supabase,
      policy,
      requesterProfile: requester,
      leaveType,
      startDate: targetStartDate,
      daysCount: targetDays,
    })

    if (eligibility.status === "not_eligible") {
      return NextResponse.json(
        { error: eligibility.reason || "You are not eligible for this leave type" },
        { status: 400 }
      )
    }

    const endDate = targetSegments.endDate
    const resumeDate = await getNextBusinessDate(supabase, endDate, requester.work_location || "global")
    assertBlackoutWindowAllowed({
      startDate: targetStartDate,
      endDate,
      emergencyOverride: emergency_override,
    })

    let relieverId = existingRequest.reliever_id
    let relieverDepartmentId: string | null | undefined = existingRequest.reliever_id ? undefined : null
    if (reliever_identifier) {
      const reliever = await resolveProfileByIdentifier(validationClient, reliever_identifier, "Reliever")
      relieverId = reliever.id
      relieverDepartmentId = reliever.department_id
    }

    if (relieverId && typeof relieverDepartmentId === "undefined") {
      relieverDepartmentId = await getUserDepartmentId(supabase, relieverId)
    }

    if (!relieverId || relieverId === user.id) {
      return NextResponse.json({ error: "Invalid reliever selected" }, { status: 400 })
    }
    assertSameDepartmentReliever({
      requesterDepartmentId: requester.department_id,
      relieverDepartmentId,
    })

    await assertNoOverlap(validationClient, user.id, targetStartDate, endDate, id)
    await assertNoDepartmentOverlap(validationClient, user.id, requester.department_id, targetStartDate, endDate, id)
    await assertRequesterNotBlockedByRelieverCommitment(validationClient, user.id, targetStartDate, endDate, id)
    await assertRelieverAvailability(validationClient, relieverId, targetStartDate, endDate, id)

    // The request being edited is excluded from the sum, so its own days are not counted
    // against the employee twice.
    const remainingDays = await getRemainingDays(supabase, user.id, targetLeaveTypeId, {
      year: parseISODate(targetStartDate).getUTCFullYear(),
      excludeRequestId: id,
    })

    if (targetDays > remainingDays) {
      return NextResponse.json(
        {
          error: `Insufficient leave balance. You requested ${targetDays} day(s), but only ${remainingDays} day(s) remain.`,
        },
        { status: 400 }
      )
    }

    const requesterRouteKind = classifyRequesterKind(requester)
    const routeSnapshot = await buildResolvedRouteSnapshot({
      supabase: validationClient,
      requester,
      requesterId: user.id,
      requesterKind: requesterRouteKind,
      relieverId,
    })

    const firstStage = getRouteStageByOrder(routeSnapshot, 1)
    if (!firstStage) {
      return NextResponse.json({ error: "LEAVE_APPROVER_NOT_CONFIGURED:first_stage" }, { status: 400 })
    }

    const departmentLeadStage = routeSnapshot.find((stage) => stage.approver_role_code === "department_lead")

    const { data: updatedRequest, error } = await supabase
      .from("leave_requests")
      .update({
        leave_type_id: targetLeaveTypeId,
        start_date: targetStartDate,
        end_date: endDate,
        resume_date: resumeDate,
        days_count: targetDays,
        reason: reason || existingRequest.reason,
        reliever_id: relieverId,
        supervisor_id: departmentLeadStage?.approver_user_id || null,
        handover_note: handover_note || existingRequest.handover_note,
        handover_checklist_url:
          typeof handover_checklist_url !== "undefined"
            ? handover_checklist_url
            : existingRequest.handover_checklist_url,
        requested_days_mode: policy.accrual_mode || "calendar_days",
        request_kind:
          existingRequest.request_kind === "extension" ? "extension" : emergency_override ? "emergency" : "standard",
        status: eligibility.status === "missing_evidence" ? "pending_evidence" : "pending",
        requester_route_kind: requesterRouteKind,
        route_snapshot: routeSnapshot,
        current_stage_order: 1,
        current_stage_code: firstStage.stage_code,
        current_approver_user_id: firstStage.approver_user_id,
        approval_stage: firstStage.stage_code,
        lead_reconfirm_required: false,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 })

    if (rawSegments) {
      await validationClient.from("leave_request_segments").delete().eq("leave_request_id", id)
      const { error: segmentsError } = await validationClient.from("leave_request_segments").insert(
        targetSegments.segments.map((segment) => ({
          leave_request_id: id,
          start_date: segment.start_date,
          end_date: segment.end_date,
          days_count: segment.days_count,
          segment_order: segment.segment_order,
        }))
      )
      if (segmentsError) {
        log.error({ err: segmentsError, leaveRequestId: id }, "Failed to update leave request segments")
      }
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "leave_request",
        entityId: id,
        newValues: {
          leave_type_id: targetLeaveTypeId,
          start_date: targetStartDate,
          end_date: endDate,
          days_count: targetDays,
        },
        context: { actorId: user.id, source: "api", route: "/api/hr/leave/requests" },
      },
      { failOpen: true }
    )

    if (updatedRequest && updatedRequest.status === "pending") {
      const isRelieverStage = firstStage.approver_role_code === "reliever"
      const reqName =
        requester.full_name || `${requester.first_name || ""} ${requester.last_name || ""}`.trim() || "Employee"
      const ref = formatLeaveReference(updatedRequest.id)
      const refSuffix = ref ? ` — ${ref}` : ""

      await notifyStageApprover({
        supabase,
        approverUserId: firstStage.approver_user_id,
        title: isRelieverStage ? "Updated leave relief request" : "Updated leave request awaiting your approval",
        message: `${reqName} updated their leave request for ${leaveType.name} (${targetDays} day(s), ${targetStartDate} to ${endDate}). Review the updated details and confirm.`,
        actorId: user.id,
        entityId: updatedRequest.id,
        linkUrl: "/hr/leave",
        emailSubject: isRelieverStage
          ? `Action Required: Updated Leave Relief for ${reqName}${refSuffix}`
          : `Action Required: Updated Leave Request — ${reqName}${refSuffix}`,
        emailTitle: isRelieverStage ? "Updated Leave Relief Request" : "Updated Leave Request",
        badgeText: isRelieverStage ? "Relief Required" : "Action Required",
        detailsTitle: "Updated Request Details",
        details: [
          { label: "Employee", value: reqName },
          { label: "Department", value: requester.department || "-" },
          { label: "Leave Type", value: leaveType.name || "-" },
          { label: "Duration", value: `${targetDays} day(s)` },
          { label: "Period", value: `${targetStartDate} to ${endDate}` },
          { label: "Resumption Date", value: resumeDate || "-" },
          ...(updatedRequest.handover_note ? [{ label: "Handover Note", value: updatedRequest.handover_note }] : []),
          ...(updatedRequest.reason ? [{ label: "Reason", value: updatedRequest.reason }] : []),
        ],
        ctaLabel: isRelieverStage ? "Review & Confirm Relief" : "Review & Endorse",
      })
    }

    return NextResponse.json({
      data: {
        ...updatedRequest,
        required_documents: eligibility.requiredDocuments,
        missing_documents: eligibility.missingDocuments,
      },
      message: "Leave request updated successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in PATCH")
    const message = error instanceof Error ? error.message : "An error occurred"
    const status =
      message.startsWith("LEAVE_APPROVER_NOT_CONFIGURED:") ||
      message.startsWith("LEAVE_APPROVER_CONFLICT:") ||
      message.toLowerCase().includes("overlap") ||
      message.toLowerCase().includes("reliever")
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
