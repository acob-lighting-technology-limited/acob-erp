import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  areRequiredDocumentsVerified,
  assertNoOverlap,
  assertRelieverAvailability,
  computeLeaveDates,
  evaluateLeaveEligibility,
  getLeavePolicy,
  resolveProfileByIdentifier,
} from "@/lib/hr/leave-workflow"
import {
  buildResolvedRouteSnapshot,
  classifyRequesterKind,
  getRouteStageByOrder,
  notifyStageApprover,
  stageCodeForRole,
} from "@/lib/hr/leave-routing"

function isRelieverStage(request: any) {
  const stage = request.current_stage_code || request.approval_stage
  return stage === "pending_reliever" || stage === "reliever_pending"
}

async function canRequesterModifyBeforeRelieverDecision(supabase: any, request: any) {
  if (!["pending", "pending_evidence"].includes(request.status)) return false
  if (!isRelieverStage(request)) return false

  const { data: relieverDecisionRows, error } = await supabase
    .from("leave_approvals")
    .select("id")
    .eq("leave_request_id", request.id)
    .eq("stage_code", stageCodeForRole("reliever"))
    .eq("superseded", false)
    .in("status", ["approved", "rejected"])
    .limit(1)

  if (error) throw new Error("Failed to validate reliever decision state")
  return !(relieverDecisionRows && relieverDecisionRows.length > 0)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const userId = searchParams.get("user_id")
    const all = searchParams.get("all") === "true"

    let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)

    const targetUserId = userId || user.id

    if (!all) {
      query = query.eq("user_id", targetUserId)
    }

    const { data: requests, error } = await query
    if (error) {
      return NextResponse.json({ error: `Failed to fetch leave requests: ${error.message}` }, { status: 500 })
    }

    const requestRowsRaw = requests || []
    const requestRows = all ? requestRowsRaw : requestRowsRaw.filter((row: any) => row.user_id === targetUserId)
    const requestIds = requestRows.map((row: any) => row.id).filter(Boolean)

    const { data: balanceRows } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", targetUserId)
      .order("leave_type_id")

    let evidenceRows: any[] = []
    let approvalRows: any[] = []

    if (requestIds.length > 0) {
      const [{ data: evidenceData }, { data: approvalsData }] = await Promise.all([
        supabase
          .from("leave_evidence")
          .select("id, leave_request_id, document_type, file_url, status, verified_by, verified_at, notes, created_at")
          .in("leave_request_id", requestIds),
        supabase
          .from("leave_approvals")
          .select(
            "id, leave_request_id, approver_id, approval_level, status, comments, approved_at, stage_code, stage_order, superseded, reliever_revision"
          )
          .in("leave_request_id", requestIds),
      ])

      evidenceRows = evidenceData || []
      approvalRows = approvalsData || []
    }

    const profileIdSet = new Set<string>()
    for (const row of requestRows) {
      if (row.user_id) profileIdSet.add(row.user_id)
      if (row.reliever_id) profileIdSet.add(row.reliever_id)
      if (row.supervisor_id) profileIdSet.add(row.supervisor_id)
    }
    for (const approval of approvalRows) {
      if (approval.approver_id) profileIdSet.add(approval.approver_id)
    }

    const leaveTypeIdSet = new Set<string>()
    for (const row of requestRows) {
      if (row.leave_type_id) leaveTypeIdSet.add(row.leave_type_id)
    }
    for (const balance of balanceRows || []) {
      if (balance.leave_type_id) leaveTypeIdSet.add(balance.leave_type_id)
    }

    let profileRows: any[] = []
    let leaveTypeRows: any[] = []

    const profileIds = Array.from(profileIdSet)
    const leaveTypeIds = Array.from(leaveTypeIdSet)

    if (profileIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name, company_email, department_id")
        .in("id", profileIds)
      profileRows = data || []
    }

    if (leaveTypeIds.length > 0) {
      const { data } = await supabase
        .from("leave_types")
        .select("id, name, code, description, max_days, requires_approval")
        .in("id", leaveTypeIds)
      leaveTypeRows = data || []
    }

    const profileMap = new Map((profileRows || []).map((row: any) => [row.id, row]))
    const leaveTypeMap = new Map((leaveTypeRows || []).map((row: any) => [row.id, row]))
    const evidenceByRequest = new Map<string, any[]>()
    const approvalsByRequest = new Map<string, any[]>()

    for (const evidence of evidenceRows) {
      const rows = evidenceByRequest.get(evidence.leave_request_id) || []
      rows.push(evidence)
      evidenceByRequest.set(evidence.leave_request_id, rows)
    }

    for (const approval of approvalRows) {
      const rows = approvalsByRequest.get(approval.leave_request_id) || []
      rows.push({
        ...approval,
        approver: approval.approver_id ? profileMap.get(approval.approver_id) || null : null,
      })
      approvalsByRequest.set(approval.leave_request_id, rows)
    }

    const enriched = await Promise.all(
      requestRows.map(async (leaveRequest: any) => {
        const policy = await getLeavePolicy(supabase, leaveRequest.leave_type_id)
        const requiredDocs = policy.required_documents || []
        const evidence = await areRequiredDocumentsVerified(supabase, leaveRequest.id, requiredDocs)
        return {
          ...leaveRequest,
          user: leaveRequest.user_id ? profileMap.get(leaveRequest.user_id) || null : null,
          reliever: leaveRequest.reliever_id ? profileMap.get(leaveRequest.reliever_id) || null : null,
          supervisor: leaveRequest.supervisor_id ? profileMap.get(leaveRequest.supervisor_id) || null : null,
          leave_type: leaveRequest.leave_type_id ? leaveTypeMap.get(leaveRequest.leave_type_id) || null : null,
          evidence: evidenceByRequest.get(leaveRequest.id) || [],
          approvals: approvalsByRequest.get(leaveRequest.id) || [],
          required_documents: requiredDocs,
          evidence_complete: evidence.complete,
          missing_documents: evidence.missing,
        }
      })
    )

    const balances = (balanceRows || []).map((row: any) => ({
      ...row,
      leave_type: row.leave_type_id ? leaveTypeMap.get(row.leave_type_id) || null : null,
    }))

    return NextResponse.json({ data: enriched, balances: balances || [] })
  } catch (error) {
    console.error("Error in GET /api/hr/leave/requests:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { leave_type_id, start_date, days_count, end_date, reason, reliever_identifier, handover_note } = body

    if (!leave_type_id || !start_date || !reason || !handover_note || !reliever_identifier) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const parsedDays = Number(days_count)
    const fallbackDays = end_date
      ? Math.ceil(
          (new Date(`${end_date}T00:00:00.000Z`).getTime() - new Date(`${start_date}T00:00:00.000Z`).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 0

    const effectiveDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : fallbackDays
    if (!effectiveDays || effectiveDays <= 0) {
      return NextResponse.json({ error: "Number of days must be greater than zero" }, { status: 400 })
    }

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
      .select("id, name, code")
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

    const { endDate, resumeDate } = await computeLeaveDates({
      supabase,
      startDate: start_date,
      daysCount: effectiveDays,
      accrualMode: (policy.accrual_mode as "calendar_days" | "business_days") || "calendar_days",
      location: requester.work_location || "global",
    })

    const reliever = await resolveProfileByIdentifier(supabase, reliever_identifier, "Reliever")

    if (reliever.id === user.id) {
      return NextResponse.json({ error: "You cannot assign yourself as reliever" }, { status: 400 })
    }

    await assertNoOverlap(supabase, user.id, start_date, endDate)
    await assertRelieverAvailability(supabase, reliever.id, start_date, endDate)

    const { data: balance } = await supabase
      .from("leave_balances")
      .select("balance_days")
      .eq("user_id", user.id)
      .eq("leave_type_id", leave_type_id)
      .single()

    if (balance && effectiveDays > balance.balance_days) {
      return NextResponse.json(
        { error: `Insufficient leave balance. You have ${balance.balance_days} days remaining.` },
        { status: 400 }
      )
    }

    const { data: existingRequest } = await supabase
      .from("leave_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "pending_evidence"])
      .limit(1)

    if (existingRequest && existingRequest.length > 0) {
      return NextResponse.json(
        { error: "You already have an active leave request. Complete it before submitting another." },
        { status: 400 }
      )
    }

    const requesterRouteKind = classifyRequesterKind(requester)
    const routeSnapshot = await buildResolvedRouteSnapshot({
      supabase,
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
        handover_note,
        requested_days_mode: policy.accrual_mode || "calendar_days",
        request_kind: "standard",
      })
      .select()
      .single()

    if (error || !newRequest) {
      const dbMessage = error?.message
        ? `Failed to create leave request: ${error.message}`
        : "Failed to create leave request"
      return NextResponse.json({ error: dbMessage }, { status: 500 })
    }

    const requesterName = requester.full_name || `${requester.first_name || ""} ${requester.last_name || ""}`.trim()

    if (initialStatus === "pending") {
      await notifyStageApprover({
        supabase,
        approverUserId: firstStage.approver_user_id,
        title: "Leave request awaiting your approval",
        message: `${requesterName || "Employee"} requested ${effectiveDays} day(s) leave from ${start_date} to ${endDate}.`,
        actorId: user.id,
        entityId: newRequest.id,
        linkUrl: "/dashboard/leave",
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
    console.error("Error in POST /api/hr/leave/requests:", error)
    const message = error instanceof Error ? error.message : "An error occurred"
    const status =
      message.startsWith("LEAVE_APPROVER_NOT_CONFIGURED:") || message.startsWith("LEAVE_APPROVER_CONFLICT:") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { id, leave_type_id, start_date, days_count, end_date, reason, reliever_identifier, handover_note } = body

    if (!id) return NextResponse.json({ error: "Leave request ID is required" }, { status: 400 })

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
      const newReliever = await resolveProfileByIdentifier(supabase, reliever_identifier, "Reliever")

      if (!newReliever?.id || newReliever.id === existingRequest.user_id) {
        return NextResponse.json({ error: "Invalid reliever selected" }, { status: 400 })
      }

      await assertRelieverAvailability(
        supabase,
        newReliever.id,
        existingRequest.start_date,
        existingRequest.end_date,
        existingRequest.id
      )

      const routeSnapshot = Array.isArray(existingRequest.route_snapshot) ? [...existingRequest.route_snapshot] : []
      const updatedSnapshot = routeSnapshot.map((stage: any) => {
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

      await notifyStageApprover({
        supabase,
        approverUserId: newReliever.id,
        title: "Leave request reassigned to you as reliever",
        message: "A leave request now requires your reliever approval before workflow continues.",
        actorId: user.id,
        entityId: existingRequest.id,
        linkUrl: "/dashboard/leave",
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
    const targetStartDate = start_date || existingRequest.start_date

    const parsedDays = Number(days_count)
    const fallbackDays = end_date
      ? Math.ceil(
          (new Date(`${end_date}T00:00:00.000Z`).getTime() - new Date(`${targetStartDate}T00:00:00.000Z`).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : existingRequest.days_count

    const targetDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : fallbackDays

    const { data: requester } = await supabase
      .from("profiles")
      .select(
        "id, department, department_id, is_department_lead, lead_departments, gender, employment_date, work_location, employment_type, marital_status, has_children, pregnancy_status"
      )
      .eq("id", user.id)
      .single()

    if (!requester) {
      return NextResponse.json({ error: "Failed to load employee profile" }, { status: 400 })
    }

    const { data: leaveType } = await supabase
      .from("leave_types")
      .select("id, name, code")
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

    const { endDate, resumeDate } = await computeLeaveDates({
      supabase,
      startDate: targetStartDate,
      daysCount: targetDays,
      accrualMode: (policy.accrual_mode as "calendar_days" | "business_days") || "calendar_days",
      location: requester.work_location || "global",
    })

    let relieverId = existingRequest.reliever_id
    if (reliever_identifier) {
      const reliever = await resolveProfileByIdentifier(supabase, reliever_identifier, "Reliever")
      relieverId = reliever.id
    }

    if (!relieverId || relieverId === user.id) {
      return NextResponse.json({ error: "Invalid reliever selected" }, { status: 400 })
    }

    await assertNoOverlap(supabase, user.id, targetStartDate, endDate, id)
    await assertRelieverAvailability(supabase, relieverId, targetStartDate, endDate, id)

    const { data: balance } = await supabase
      .from("leave_balances")
      .select("balance_days")
      .eq("user_id", user.id)
      .eq("leave_type_id", targetLeaveTypeId)
      .single()

    if (balance && targetDays > balance.balance_days) {
      return NextResponse.json(
        { error: `Insufficient leave balance. You have ${balance.balance_days} days remaining.` },
        { status: 400 }
      )
    }

    const requesterRouteKind = classifyRequesterKind(requester)
    const routeSnapshot = await buildResolvedRouteSnapshot({
      supabase,
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
        requested_days_mode: policy.accrual_mode || "calendar_days",
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

    return NextResponse.json({
      data: {
        ...updatedRequest,
        required_documents: eligibility.requiredDocuments,
        missing_documents: eligibility.missingDocuments,
      },
      message: "Leave request updated successfully",
    })
  } catch (error) {
    console.error("Error in PUT /api/hr/leave/requests:", error)
    const message = error instanceof Error ? error.message : "An error occurred"
    const status =
      message.startsWith("LEAVE_APPROVER_NOT_CONFIGURED:") || message.startsWith("LEAVE_APPROVER_CONFLICT:") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "Leave request ID is required" }, { status: 400 })

    const { data: existingRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("id, user_id, status, approval_stage, current_stage_code")
      .eq("id", id)
      .single()

    if (fetchError || !existingRequest) return NextResponse.json({ error: "Leave request not found" }, { status: 404 })

    if (existingRequest.user_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own leave requests" }, { status: 403 })
    }

    const canModify = await canRequesterModifyBeforeRelieverDecision(supabase, existingRequest)
    if (!canModify) {
      return NextResponse.json({ error: "Only requests pending reliever review can be deleted" }, { status: 400 })
    }

    const { error } = await supabase.from("leave_requests").delete().eq("id", id)
    if (error) return NextResponse.json({ error: "Failed to delete leave request" }, { status: 500 })

    return NextResponse.json({ message: "Leave request deleted successfully" })
  } catch (error) {
    console.error("Error in DELETE /api/hr/leave/requests:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
