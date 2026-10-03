/** POST /api/hr/leave/requests (split from route.ts, audit 5.10). */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import {
  assertNoOverlap,
  assertRelieverAvailability,
  evaluateLeaveEligibility,
  formatLeaveReference,
  getLeavePolicy,
  getNextBusinessDate,
  notifyUsers,
  parseISODate,
  resolveProfileByIdentifier,
} from "@/lib/hr/leave-workflow"
import { getRemainingDays } from "@/lib/hr/leave-entitlement"
import {
  buildResolvedRouteSnapshot,
  classifyRequesterKind,
  getRouteStageByOrder,
  notifyStageApprover,
} from "@/lib/hr/leave-routing"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import {
  log,
  CreateLeaveRequestSchema,
  resolveSegments,
  resolveSegmentsWithHolidays,
  isRelieverStage,
  assertNoDepartmentOverlap,
  assertRequesterNotBlockedByRelieverCommitment,
  assertSameDepartmentReliever,
  assertBlackoutWindowAllowed,
} from "./shared"

export async function POST(request: NextRequest) {
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
    const parsed = CreateLeaveRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
    }
    const {
      leave_type_id,
      segments: rawSegments,
      emergency_override,
      reason,
      reliever_identifier,
      handover_note,
      handover_checklist_url,
    } = parsed.data

    let resolved: ReturnType<typeof resolveSegments>
    try {
      // Company-wide holidays apply to every requester; site-specific holidays
      // would need the profile, which is loaded below.
      resolved = (await resolveSegmentsWithHolidays(validationClient, rawSegments)).resolved
    } catch (segmentError) {
      return NextResponse.json(
        { error: segmentError instanceof Error ? segmentError.message : "Invalid date ranges" },
        { status: 400 }
      )
    }
    const { segments, startDate: start_date, endDate: aggregateEndDate, totalDays: effectiveDays } = resolved

    const { data: requester, error: requesterError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, company_email, department, department_id, is_department_lead, lead_departments, gender, employment_date, work_location, employment_type, marital_status, has_children, pregnancy_status"
      )
      .eq("id", user.id)
      .single()

    if (requesterError || !requester) {
      return NextResponse.json({ error: "Failed to load employee profile" }, { status: 400 })
    }

    const { data: leaveType } = await supabase
      .from("leave_types")
      .select("id, name, code, max_days")
      .eq("id", leave_type_id)
      .single()
    if (!leaveType) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 400 })
    }

    const policy = await getLeavePolicy(supabase, leave_type_id)
    const eligibility = await evaluateLeaveEligibility({
      supabase,
      policy,
      requesterProfile: requester,
      leaveType,
      startDate: start_date,
      daysCount: effectiveDays,
    })

    if (eligibility.status === "not_eligible") {
      return NextResponse.json(
        { error: eligibility.reason || "You are not eligible for this leave type" },
        { status: 400 }
      )
    }

    const endDate = aggregateEndDate
    const resumeDate = await getNextBusinessDate(supabase, endDate, requester.work_location || "global")
    assertBlackoutWindowAllowed({
      startDate: start_date,
      endDate,
      emergencyOverride: emergency_override,
    })

    const reliever = await resolveProfileByIdentifier(validationClient, reliever_identifier, "Reliever")

    if (reliever.id === user.id) {
      return NextResponse.json({ error: "You cannot assign yourself as reliever" }, { status: 400 })
    }
    assertSameDepartmentReliever({
      requesterDepartmentId: requester.department_id,
      relieverDepartmentId: reliever.department_id,
    })

    await assertNoOverlap(validationClient, user.id, start_date, endDate)
    await assertNoDepartmentOverlap(validationClient, user.id, requester.department_id, start_date, endDate)
    await assertRequesterNotBlockedByRelieverCommitment(validationClient, user.id, start_date, endDate)
    await assertRelieverAvailability(validationClient, reliever.id, start_date, endDate)

    // Remaining days are derived from the leave type's allowance minus this user's own
    // requests for the year, so there is no stored balance to reserve against and nothing to
    // put back if the request is later cancelled — the sum simply changes.
    const remainingDays = await getRemainingDays(supabase, user.id, leave_type_id, {
      year: parseISODate(start_date).getUTCFullYear(),
    })

    if (effectiveDays > remainingDays) {
      return NextResponse.json(
        {
          error: `Insufficient leave balance. You requested ${effectiveDays} day(s), but only ${remainingDays} day(s) remain.`,
        },
        { status: 400 }
      )
    }

    const { data: existingWorkflowRequest } = await supabase
      .from("leave_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "pending_evidence"])
      .limit(1)

    if (existingWorkflowRequest && existingWorkflowRequest.length > 0) {
      return NextResponse.json(
        { error: "You already have an active leave request. Complete it before submitting another." },
        { status: 400 }
      )
    }

    const { data: activeApprovedRequest } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", start_date)
      .limit(1)

    if (activeApprovedRequest && activeApprovedRequest.length > 0) {
      const activeRange = activeApprovedRequest[0]
      return NextResponse.json(
        {
          error: `You already have an approved leave overlapping these dates (${activeRange.start_date} to ${activeRange.end_date}). Choose a different period.`,
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
      relieverId: reliever.id,
    })

    const firstStage = getRouteStageByOrder(routeSnapshot, 1)
    if (!firstStage) {
      return NextResponse.json({ error: "LEAVE_APPROVER_NOT_CONFIGURED:first_stage" }, { status: 400 })
    }

    const departmentLeadStage = routeSnapshot.find((stage) => stage.approver_role_code === "department_lead")
    const initialStatus = eligibility.status === "missing_evidence" ? "pending_evidence" : "pending"

    const effectiveHandoverNote =
      handover_note?.trim() || (handover_checklist_url ? "Handover document attached" : null)

    const { data: newRequest, error } = await supabase
      .from("leave_requests")
      .insert({
        user_id: user.id,
        leave_type_id,
        start_date,
        end_date: endDate,
        resume_date: resumeDate,
        days_count: effectiveDays,
        reason,
        status: initialStatus,
        approval_stage: firstStage.stage_code,
        current_stage_code: firstStage.stage_code,
        current_stage_order: firstStage.stage_order,
        current_approver_user_id: firstStage.approver_user_id,
        requester_route_kind: requesterRouteKind,
        route_snapshot: routeSnapshot,
        reliever_id: reliever.id,
        supervisor_id: departmentLeadStage?.approver_user_id || null,
        handover_note: effectiveHandoverNote,
        handover_checklist_url: handover_checklist_url || null,
        requested_days_mode: policy.accrual_mode || "calendar_days",
        request_kind: emergency_override ? "emergency" : "standard",
      })
      .select()
      .single()

    if (error || !newRequest) {
      const dbMessage = error?.message
        ? `Failed to create leave request: ${error.message}`
        : "Failed to create leave request"
      return NextResponse.json({ error: dbMessage }, { status: 500 })
    }

    const { error: segmentsError } = await validationClient.from("leave_request_segments").insert(
      segments.map((segment) => ({
        leave_request_id: newRequest.id,
        start_date: segment.start_date,
        end_date: segment.end_date,
        days_count: segment.days_count,
        segment_order: segment.segment_order,
      }))
    )
    if (segmentsError) {
      log.error({ err: segmentsError, leaveRequestId: newRequest.id }, "Failed to write leave request segments")
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "leave_request",
        entityId: newRequest.id,
        newValues: { leave_type_id, start_date, end_date: endDate, days_count: effectiveDays, status: initialStatus },
        context: { actorId: user.id, source: "api", route: "/api/hr/leave/requests" },
      },
      { failOpen: true }
    )

    const requesterName =
      requester.full_name || `${requester.first_name || ""} ${requester.last_name || ""}`.trim() || "Employee"
    const ref = formatLeaveReference(newRequest.id)
    const refSuffix = ref ? ` — ${ref}` : ""
    const relieverName = reliever.full_name || reliever.company_email || "Assigned Reliever"

    if (initialStatus === "pending") {
      const isRelieverStage = firstStage.approver_role_code === "reliever"

      // 1. Notify first stage approver (Reliever or Department Lead) with rich details
      await notifyStageApprover({
        supabase,
        approverUserId: firstStage.approver_user_id,
        title: isRelieverStage ? "Leave relief confirmation required" : "Leave request awaiting your approval",
        message: isRelieverStage
          ? `${requesterName} selected you as reliever for ${leaveType.name} (${effectiveDays} day(s), ${start_date} to ${endDate}). Review the handover note and confirm coverage so the request can proceed.`
          : `${requesterName} submitted a leave request for ${leaveType.name} (${effectiveDays} day(s), ${start_date} to ${endDate}) awaiting your endorsement.`,
        actorId: user.id,
        entityId: newRequest.id,
        linkUrl: "/hr/leave",
        emailSubject: isRelieverStage
          ? `Action Required: Leave Relief Confirmation for ${requesterName}${refSuffix}`
          : `Action Required: Leave Request Awaiting Your Approval — ${requesterName}${refSuffix}`,
        emailTitle: isRelieverStage ? "Leave Relief Confirmation Required" : "Leave Request Awaiting Your Approval",
        badgeText: isRelieverStage ? "Relief Confirmation Required" : "Action Required",
        detailsTitle: "Leave Request Details",
        details: [
          { label: "Employee", value: requesterName },
          { label: "Department", value: requester.department || "-" },
          { label: "Leave Type", value: leaveType.name || "-" },
          { label: "Duration", value: `${effectiveDays} day(s)` },
          { label: "Period", value: `${start_date} to ${endDate}` },
          { label: "Resumption Date", value: resumeDate || "-" },
          ...(handover_checklist_url ? [{ label: "Handover Document", value: "Attached (View in Leave Portal)" }] : []),
          ...(handover_note && (!handover_checklist_url || !handover_note.startsWith("Attached:"))
            ? [{ label: "Handover Note", value: handover_note }]
            : []),
          ...(reason ? [{ label: "Reason", value: reason }] : []),
        ],
        ctaLabel: isRelieverStage ? "Review & Confirm Relief" : "Review & Endorse",
      })

      // 2. Send submission acknowledgement email to the requester
      await notifyUsers(supabase, {
        userIds: [user.id],
        title: "Leave request submitted",
        message: `Your leave request for ${leaveType.name} (${start_date} to ${endDate}) was submitted and is pending ${
          isRelieverStage
            ? `relief confirmation by ${relieverName}`
            : `approval at ${firstStage.stage_code.replaceAll("_", " ")}`
        }.`,
        actorId: user.id,
        entityId: newRequest.id,
        linkUrl: "/hr/leave",
        emailSubject: `Leave Request Submitted Successfully${refSuffix}`,
        emailTitle: "Leave Request Submitted",
        badgeText: "Submitted — Pending Review",
        badgeVariant: "info",
        detailsTitle: "Request Summary",
        details: [
          { label: "Leave Type", value: leaveType.name || "-" },
          { label: "Duration", value: `${effectiveDays} day(s)` },
          { label: "Period", value: `${start_date} to ${endDate}` },
          { label: "Resumption Date", value: resumeDate || "-" },
          { label: "Assigned Reliever", value: relieverName },
          {
            label: "Current Stage",
            value: isRelieverStage
              ? `Relief Confirmation (${relieverName})`
              : firstStage.stage_code.replaceAll("_", " "),
          },
        ],
        ctaLabel: "View Leave Status",
      })
    } else if (initialStatus === "pending_evidence") {
      // Notify requester that evidence upload is required
      await notifyUsers(supabase, {
        userIds: [user.id],
        title: "Supporting evidence required for leave request",
        message: `Your leave request for ${leaveType.name} (${start_date} to ${endDate}) requires supporting documentation before it can proceed to approvals.`,
        actorId: user.id,
        entityId: newRequest.id,
        linkUrl: "/hr/leave",
        emailSubject: `Action Required: Supporting Evidence Needed for Leave Request${refSuffix}`,
        emailTitle: "Supporting Evidence Required",
        badgeText: "Evidence Required",
        badgeVariant: "warning",
        detailsTitle: "Leave Request Details",
        details: [
          { label: "Leave Type", value: leaveType.name || "-" },
          { label: "Duration", value: `${effectiveDays} day(s)` },
          { label: "Period", value: `${start_date} to ${endDate}` },
          ...(eligibility.missingDocuments?.length
            ? [{ label: "Required Documents", value: eligibility.missingDocuments.join(", ") }]
            : []),
        ],
        ctaLabel: "Upload Required Evidence",
      })
    }

    return NextResponse.json({
      data: {
        ...newRequest,
        required_documents: eligibility.requiredDocuments,
        missing_documents: eligibility.missingDocuments,
      },
      message:
        initialStatus === "pending_evidence"
          ? "Leave request saved. Upload required evidence to continue approval workflow."
          : "Leave request created successfully",
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in POST")
    const message = error instanceof Error ? error.message : "An error occurred"
    const status =
      message.startsWith("LEAVE_APPROVER_NOT_CONFIGURED:") ||
      message.startsWith("LEAVE_APPROVER_CONFLICT:") ||
      message.toLowerCase().includes("overlap") ||
      message.toLowerCase().includes("reliever") ||
      message.toLowerCase().includes("already has an approved leave")
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}

// POST kept for backwards compat — prefer PATCH
