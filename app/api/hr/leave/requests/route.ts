import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  LEAVE_PENDING_STAGES,
  areRequiredDocumentsVerified,
  assertNoOverlap,
  assertRelieverAvailability,
  computeLeaveDates,
  evaluateLeaveEligibility,
  getLeavePolicy,
  getSupervisorForUser,
  notifyUsers,
  resolveProfileByIdentifier,
} from "@/lib/hr/leave-workflow"

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

    let query = supabase
      .from("leave_requests")
      .select(
        `
        *,
        user:profiles!leave_requests_user_id_fkey (
          id, first_name, last_name, full_name, company_email, department_id
        ),
        reliever:profiles!leave_requests_reliever_id_fkey (
          id, first_name, last_name, full_name, company_email
        ),
        supervisor:profiles!leave_requests_supervisor_id_fkey (
          id, first_name, last_name, full_name, company_email
        ),
        leave_type:leave_types!leave_requests_leave_type_id_fkey (
          id, name, code, description, max_days
        ),
        evidence:leave_evidence (
          id, document_type, file_url, status, verified_by, verified_at, notes, created_at
        ),
        approvals:leave_approvals (
          id, approver_id, approval_level, status, comments, approved_at,
          approver:profiles!leave_approvals_approver_id_fkey (id, first_name, last_name, full_name)
        )
      `
      )
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)
    if (userId) query = query.eq("user_id", userId)

    const { data: requests, error } = await query
    if (error) return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 })

    const targetUserId = userId || user.id
    const { data: balances } = await supabase
      .from("leave_balances")
      .select(
        `
        *,
        leave_type:leave_types!leave_balances_leave_type_id_fkey (id, name, description, max_days, requires_approval)
      `
      )
      .eq("user_id", targetUserId)
      .order("leave_type_id")

    const enriched = await Promise.all(
      (requests || []).map(async (request: any) => {
        const policy = await getLeavePolicy(supabase, request.leave_type_id)
        const requiredDocs = policy.required_documents || []
        const evidence = await areRequiredDocumentsVerified(supabase, request.id, requiredDocs)
        return {
          ...request,
          required_documents: requiredDocs,
          evidence_complete: evidence.complete,
          missing_documents: evidence.missing,
        }
      })
    )

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
    const {
      leave_type_id,
      start_date,
      days_count,
      end_date,
      reason,
      reliever_identifier,
      handover_note,
      handover_checklist_url,
    } = body

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
        "id, full_name, first_name, last_name, company_email, department_id, gender, employment_date, work_location, employment_type, marital_status, has_children, pregnancy_status"
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
    const supervisor = await getSupervisorForUser(supabase, user.id)

    if (reliever.id === user.id)
      return NextResponse.json({ error: "You cannot assign yourself as reliever" }, { status: 400 })
    if (supervisor.id === user.id)
      return NextResponse.json({ error: "You cannot approve your own leave request" }, { status: 400 })
    if (reliever.id === supervisor.id)
      return NextResponse.json({ error: "Reliever and supervisor must be different people" }, { status: 400 })

    if (requester.department_id && reliever.department_id && requester.department_id !== reliever.department_id) {
      return NextResponse.json({ error: "Reliever must be from the same department" }, { status: 400 })
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
        approval_stage: LEAVE_PENDING_STAGES.RELIEVER,
        reliever_id: reliever.id,
        supervisor_id: supervisor.id,
        handover_note,
        handover_checklist_url: handover_checklist_url || null,
        requested_days_mode: policy.accrual_mode || "calendar_days",
        request_kind: "standard",
      })
      .select()
      .single()

    if (error || !newRequest) {
      return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
    }

    const requesterName = requester.full_name || `${requester.first_name || ""} ${requester.last_name || ""}`.trim()

    if (initialStatus === "pending") {
      await notifyUsers(supabase, {
        userIds: [reliever.id, supervisor.id],
        title: "Leave request awaiting review",
        message: `${requesterName || "Employee"} requested ${effectiveDays} day(s) leave from ${start_date} to ${endDate}.`,
        actorId: user.id,
        linkUrl: "/dashboard/leave",
        entityId: newRequest.id,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
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
    const {
      id,
      leave_type_id,
      start_date,
      days_count,
      end_date,
      reason,
      reliever_identifier,
      handover_note,
      handover_checklist_url,
    } = body

    if (!id) return NextResponse.json({ error: "Leave request ID is required" }, { status: 400 })

    const { data: existingRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .single()
    if (fetchError || !existingRequest) return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    if (existingRequest.user_id !== user.id)
      return NextResponse.json({ error: "You can only edit your own leave requests" }, { status: 403 })
    if (
      !["pending", "pending_evidence"].includes(existingRequest.status) ||
      existingRequest.approval_stage !== LEAVE_PENDING_STAGES.RELIEVER
    ) {
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
        "id, gender, employment_date, work_location, employment_type, marital_status, has_children, pregnancy_status"
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
      location: requester?.work_location || "global",
    })

    let relieverId = existingRequest.reliever_id
    if (reliever_identifier) {
      const reliever = await resolveProfileByIdentifier(supabase, reliever_identifier, "Reliever")
      relieverId = reliever.id
    }

    if (!relieverId || relieverId === user.id || relieverId === existingRequest.supervisor_id) {
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
        handover_note: handover_note || existingRequest.handover_note,
        handover_checklist_url: handover_checklist_url ?? existingRequest.handover_checklist_url,
        requested_days_mode: policy.accrual_mode || "calendar_days",
        status: eligibility.status === "missing_evidence" ? "pending_evidence" : "pending",
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "An error occurred" }, { status: 500 })
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
      .select("id, user_id, status, approval_stage")
      .eq("id", id)
      .single()

    if (fetchError || !existingRequest) return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    if (existingRequest.user_id !== user.id)
      return NextResponse.json({ error: "You can only delete your own leave requests" }, { status: 403 })

    if (
      !["pending", "pending_evidence"].includes(existingRequest.status) ||
      existingRequest.approval_stage !== LEAVE_PENDING_STAGES.RELIEVER
    ) {
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
