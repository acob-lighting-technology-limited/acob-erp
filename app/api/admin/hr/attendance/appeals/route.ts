import { NextRequest, NextResponse } from "next/server"
import { parseJsonBody } from "@/lib/api/parse-body"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireApiAdminScope, getScopedDepartments } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import { notifyAttendanceMail } from "@/lib/hr/attendance-notify"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { validateLwpAwpMonthlyQuota } from "@/lib/hr/attendance-quota"
import {
  findStagedLeaveRequest,
  isStagedLeaveAppeal,
  liveAppealDayStatus,
  loadDepartmentLeads,
  notifyAppealReviewers,
} from "@/lib/hr/attendance-appeals"
import { logger } from "@/lib/logger"
import { createNotification } from "@/lib/notifications/create"

const log = logger("admin-hr-attendance-appeals")
export const dynamic = "force-dynamic"

export type AppealWithProfile = {
  id: string
  attendance_record_id: string | null
  user_id: string
  user_name: string
  department: string
  appeal_date: string
  current_status: string
  live_status: string
  requested_status: string
  appeal_reason: string
  status: "pending" | "approved" | "rejected" | "resolved"
  stage?: "pending_lead" | "pending_admin" | "pending_hr_lead" | "approved" | "rejected" | "resolved"
  initiated_by_role?: "employee" | "lead_on_behalf" | "admin_manual"
  created_by?: string | null
  created_by_name?: string | null
  lead_reviewed_by?: string | null
  lead_reviewer_name?: string | null
  department_lead_name?: string | null
  lead_reviewed_at?: string | null
  lead_resolution_note?: string | null
  admin_reviewed_by?: string | null
  admin_reviewer_name?: string | null
  admin_hr_lead_name?: string | null
  admin_reviewed_at?: string | null
  admin_resolution_note?: string | null
  reviewed_by: string | null
  reviewer_name?: string | null
  reviewed_at: string | null
  resolution_note: string | null
  created_at: string
  updated_at: string
}

type AppealRow = {
  id: string
  attendance_record_id: string | null
  user_id: string
  appeal_date: string
  current_status: string
  requested_status: string
  appeal_reason: string
  status: "pending" | "approved" | "rejected" | "resolved"
  stage?: "pending_lead" | "pending_admin" | "pending_hr_lead" | "approved" | "rejected" | "resolved"
  initiated_by_role?: "employee" | "lead_on_behalf" | "admin_manual"
  created_by?: string | null
  lead_reviewed_by?: string | null
  lead_reviewed_at?: string | null
  lead_resolution_note?: string | null
  admin_reviewed_by?: string | null
  admin_reviewed_at?: string | null
  admin_resolution_note?: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  resolution_note: string | null
  created_at: string
  updated_at: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
  is_department_lead?: boolean | null
}

export async function GET(request: NextRequest) {
  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult

    const depts = getScopedDepartments(scope)
    const dataClient = getServiceRoleClientOrFallback(supabase)

    const statusParam = request.nextUrl.searchParams.get("status") ?? "all"
    const validStatuses = ["pending", "approved", "rejected", "resolved", "all"]
    if (!validStatuses.includes(statusParam)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 })
    }

    // Resolve scoped user IDs if dept-filtered
    let scopedUserIds: string[] | null = null
    if (depts !== null) {
      if (depts.length === 0) return NextResponse.json({ data: [] })
      const { data: scopedProfiles } = await dataClient.from("profiles").select("id").in("department", depts)
      scopedUserIds = (scopedProfiles ?? []).map((p: { id: string }) => p.id)
      if (scopedUserIds.length === 0) return NextResponse.json({ data: [] })
    }

    // Fetch appeals
    let appealsQuery = dataClient
      .from("attendance_appeals")
      .select(
        "id, attendance_record_id, user_id, appeal_date, current_status, requested_status, appeal_reason, status, stage, initiated_by_role, created_by, lead_reviewed_by, lead_reviewed_at, lead_resolution_note, admin_reviewed_by, admin_reviewed_at, admin_resolution_note, reviewed_by, reviewed_at, resolution_note, created_at, updated_at"
      )
      .order("created_at", { ascending: false })

    if (statusParam !== "all") {
      appealsQuery = appealsQuery.eq("status", statusParam)
    }

    if (scopedUserIds !== null) {
      appealsQuery = appealsQuery.in("user_id", scopedUserIds)
    }

    const { data: appeals, error: appealsError } = await appealsQuery.returns<AppealRow[]>()
    if (appealsError) {
      log.error({ err: appealsError }, "Failed to fetch appeals")
      return NextResponse.json({ error: "Failed to fetch appeals" }, { status: 500 })
    }

    const rows = appeals ?? []
    if (rows.length === 0) return NextResponse.json({ data: [] })

    // Fetch profiles for enrichment (appellant, creator, reviewers)
    const userIdsToFetch = new Set<string>()
    for (const r of rows) {
      if (r.user_id) userIdsToFetch.add(r.user_id)
      if (r.created_by) userIdsToFetch.add(r.created_by)
      if (r.lead_reviewed_by) userIdsToFetch.add(r.lead_reviewed_by)
      if (r.admin_reviewed_by) userIdsToFetch.add(r.admin_reviewed_by)
      if (r.reviewed_by) userIdsToFetch.add(r.reviewed_by)
    }

    const { data: profiles } = await dataClient
      .from("profiles")
      .select("id, full_name, first_name, last_name, department, is_department_lead")
      .in("id", Array.from(userIdsToFetch))
      .returns<ProfileRow[]>()

    const profileMap = new Map<string, ProfileRow>()
    for (const p of profiles ?? []) profileMap.set(p.id, p)

    const resolveProfileName = (id?: string | null): string | null => {
      if (!id) return null
      const p = profileMap.get(id)
      if (!p) return null
      return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ") || null
    }

    const departmentLeads = await loadDepartmentLeads(dataClient)
    const admin_hr_lead_name = departmentLeads.adminHrLeadName

    const policy = await loadAttendancePolicy(dataClient)
    const uniqueUserIds = [...new Set(rows.map((r) => r.user_id))]
    const appealDates = [...new Set(rows.map((r) => r.appeal_date))]
    const { data: dayRecords } = await dataClient
      .from("attendance_records")
      .select("user_id, date, clock_in, clock_out, status, waived")
      .in("user_id", uniqueUserIds)
      .in("date", appealDates)
      .returns<
        Array<{
          user_id: string
          date: string
          clock_in: string | null
          clock_out: string | null
          status: string | null
          waived: boolean | null
        }>
      >()
    const recordByDay = new Map((dayRecords ?? []).map((record) => [`${record.user_id}::${record.date}`, record]))

    const data: AppealWithProfile[] = rows.map((r) => {
      const p = profileMap.get(r.user_id)
      const user_name = resolveProfileName(r.user_id) || "Unknown"
      const department = p?.department ?? ""
      const department_lead_name = department ? (departmentLeads.nameByDepartment.get(department) ?? null) : null
      return {
        ...r,
        user_name,
        department,
        department_lead_name,
        created_by_name: resolveProfileName(r.created_by),
        lead_reviewer_name: resolveProfileName(r.lead_reviewed_by),
        admin_reviewer_name: resolveProfileName(r.admin_reviewed_by),
        admin_hr_lead_name,
        reviewer_name:
          r.status === "pending" ? null : resolveProfileName(r.admin_reviewed_by) || resolveProfileName(r.reviewed_by),
        live_status: liveAppealDayStatus(
          recordByDay.get(`${r.user_id}::${r.appeal_date}`) ?? null,
          r.appeal_date,
          policy
        ),
      }
    })

    return NextResponse.json({ data })
  } catch (err) {
    log.error({ err: String(err) }, "Error in GET /api/admin/hr/attendance/appeals")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

const ReviewAppealSchema = z.object({
  id: z.string().trim().min(1),
  action: z.enum(["approve", "reject"]),
  resolution_note: z.string().nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult

    const parsed = await parseJsonBody(request, ReviewAppealSchema)
    if (!parsed.ok) return parsed.response
    const appealId = parsed.data.id
    const action = parsed.data.action
    const resolutionNote = parsed.data.resolution_note ?? ""

    if (!appealId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }
    if (action === "reject" && !resolutionNote) {
      return NextResponse.json({ error: "resolution_note is required when rejecting" }, { status: 400 })
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    // Fetch the appeal
    const { data: appeal, error: fetchError } = await dataClient
      .from("attendance_appeals")
      .select(
        "id, user_id, appeal_date, current_status, requested_status, appeal_reason, attendance_record_id, status, stage, initiated_by_role, created_by, lead_reviewed_by, lead_reviewed_at, lead_resolution_note, admin_reviewed_by, admin_reviewed_at, admin_resolution_note"
      )
      .eq("id", appealId)
      .maybeSingle<AppealRow>()

    if (fetchError || !appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 })
    }

    if (appeal.status !== "pending") {
      return NextResponse.json(
        { error: `Appeal is already ${appeal.status} and cannot be reviewed again` },
        { status: 409 }
      )
    }

    // Hard Rule: You cannot approve or review your own appeal
    if (scope.userId === appeal.user_id) {
      return NextResponse.json({ error: "You cannot review or approve your own appeal." }, { status: 403 })
    }

    // Fetch appellant's profile
    const { data: appellant } = await dataClient
      .from("profiles")
      .select("id, department, department_id, is_department_lead, full_name, first_name, last_name")
      .eq("id", appeal.user_id)
      .maybeSingle<{
        id: string
        department: string | null
        department_id: string | null
        is_department_lead: boolean
        full_name: string | null
        first_name: string | null
        last_name: string | null
      }>()

    // A staged sick-leave grant: the appeal decides the linked leave_requests row.
    const stagedLeave = isStagedLeaveAppeal(appeal)
      ? await findStagedLeaveRequest(dataClient, appeal.user_id, appeal.appeal_date)
      : null
    if (isStagedLeaveAppeal(appeal) && !stagedLeave) {
      return NextResponse.json(
        { error: "The leave this appeal stands for is no longer pending. It may have been removed or edited." },
        { status: 409 }
      )
    }

    const currentStage = appeal.stage || "pending_lead"
    const isAppellantLead = Boolean(appellant?.is_department_lead)
    const isCallerAdmin = Boolean(scope.isAdminLike && scope.scopeMode !== "lead")
    const isCallerAdminHrLead = Boolean(
      (scope.department === "Admin and HR" && scope.isDepartmentLead) ||
        scope.role === "super_admin" ||
        scope.role === "developer"
    )

    const now = new Date().toISOString()
    let isFinalApproval = false
    let nextStage: "pending_lead" | "pending_admin" | "pending_hr_lead" | "approved" | "rejected" = "approved"
    let nextStatus: "pending" | "approved" | "rejected" = "approved"
    const updates: Record<string, unknown> = { updated_at: now }

    // ── STAGE 1: Department Lead Review ──────────────────────────────────────────
    if (currentStage === "pending_lead") {
      const leadDepts =
        scope.leadDepartments && scope.leadDepartments.length > 0
          ? scope.leadDepartments
          : scope.department
            ? [scope.department]
            : []
      const isLeadOfAppellantDept = Boolean(
        scope.isDepartmentLead && appellant?.department && leadDepts.includes(appellant.department)
      )

      // Separation of Duties: An initiator cannot confirm their own alteration
      if (appeal.created_by && scope.userId === appeal.created_by) {
        return NextResponse.json(
          { error: "You cannot confirm an alteration you initiated. The employee's Department Lead must confirm it." },
          { status: 403 }
        )
      }

      // Guard: Admin Manual Alterations require the employee's actual Department Lead confirmation
      if (appeal.initiated_by_role === "admin_manual" && !isLeadOfAppellantDept && scope.role !== "developer") {
        return NextResponse.json(
          {
            error: `Only the Department Lead for ${appellant?.department || "this department"} can confirm this alteration.`,
          },
          { status: 403 }
        )
      }

      const scopedDepts = getScopedDepartments(scope)
      if (scopedDepts !== null && (!appellant?.department || !scopedDepts.includes(appellant.department))) {
        return NextResponse.json(
          { error: "You can only review attendance appeals for your own department" },
          { status: 403 }
        )
      }

      updates.lead_reviewed_by = scope.userId
      updates.lead_reviewed_at = now
      updates.lead_resolution_note = resolutionNote || null

      if (action === "reject") {
        nextStatus = "rejected"
        nextStage = "rejected"
      } else if (appeal.initiated_by_role === "admin_manual") {
        // An Admin Manual Alteration was made on the Admin & HR side (often by an admin
        // acting for the Admin & HR Lead), so that entry is stage 1 and the Lead's
        // confirmation is the final approval.
        isFinalApproval = true
        nextStatus = "approved"
        nextStage = "approved"
      } else {
        // Employee appeal endorsed by Lead -> moves to Stage 2 (Admin)
        nextStatus = "pending"
        nextStage = "pending_admin"
      }
    }
    // ── STAGE 2: Admin & HR Review ──────────────────────────────────────────────
    else if (currentStage === "pending_admin") {
      if (!isCallerAdmin) {
        return NextResponse.json({ error: "Only Admin & HR can review appeals at this stage." }, { status: 403 })
      }

      updates.admin_reviewed_by = scope.userId
      updates.admin_reviewed_at = now
      updates.admin_resolution_note = resolutionNote || null

      if (action === "reject") {
        nextStatus = "rejected"
        nextStage = "rejected"
      } else {
        // If the appellant is a Department Lead, Admin endorsement moves to Stage 3 (Admin & HR Lead)
        if (isAppellantLead) {
          nextStatus = "pending"
          nextStage = "pending_hr_lead"
        } else {
          // Regular employee appeal approved by Admin -> Final Approval!
          isFinalApproval = true
          nextStatus = "approved"
          nextStage = "approved"
        }
      }
    }
    // ── STAGE 3: Admin & HR Lead Final Approval (For Dept Leads) ────────────────
    else if (currentStage === "pending_hr_lead") {
      if (!isCallerAdminHrLead) {
        return NextResponse.json(
          { error: "Only the Admin & HR Lead can grant final approval for Department Lead appeals." },
          { status: 403 }
        )
      }

      updates.admin_reviewed_by = scope.userId
      updates.admin_reviewed_at = now
      updates.admin_resolution_note = resolutionNote || null

      if (action === "reject") {
        nextStatus = "rejected"
        nextStage = "rejected"
      } else {
        isFinalApproval = true
        nextStatus = "approved"
        nextStage = "approved"
      }
    }

    updates.status = nextStatus
    updates.stage = nextStage
    if (isFinalApproval || action === "reject") {
      updates.reviewed_by = scope.userId
      updates.reviewed_at = now
      updates.resolution_note = resolutionNote || null
    }

    let approvedRecordId: string | null = appeal.attendance_record_id

    // If this decision finalized an approval, write to attendance_records. A staged leave
    // grant is the exception: the approved leave_requests row (updated below) is what
    // derives on_leave for its whole range, without overwriting real punches.
    if (isFinalApproval && !stagedLeave) {
      const quotaCheck = await validateLwpAwpMonthlyQuota({
        dataClient,
        userId: appeal.user_id,
        targetStatus: appeal.requested_status,
        date: appeal.appeal_date,
        isAdminLike: scope.isAdminLike,
        excludeRecordId: appeal.attendance_record_id,
        isManualAlteration: appeal.initiated_by_role === "admin_manual",
      })
      if (!quotaCheck.allowed) {
        return NextResponse.json({ error: quotaCheck.error }, { status: 403 })
      }

      const { data: upserted, error: upsertError } = await dataClient
        .from("attendance_records")
        .upsert(
          {
            user_id: appeal.user_id,
            date: appeal.appeal_date,
            status: appeal.requested_status,
            manual_comment: resolutionNote || `Appeal approved: ${appeal.requested_status}`,
            source: "manual",
          },
          { onConflict: "user_id,date" }
        )
        .select("id")
        .maybeSingle<{ id: string }>()

      if (upsertError) {
        log.error({ err: upsertError }, "Failed to upsert attendance record on final approval")
        return NextResponse.json(
          { error: "Could not update the attendance record. Appeal was left unchanged." },
          { status: 500 }
        )
      }
      if (upserted?.id) approvedRecordId = upserted.id
    }

    // Save appeal status & stage update
    const { data: updatedAppeal, error: updateError } = await dataClient
      .from("attendance_appeals")
      .update(updates)
      .eq("id", appealId)
      .eq("status", "pending")
      .select()
      .maybeSingle()

    if (updateError || !updatedAppeal) {
      log.error({ err: updateError }, "Failed to update appeal")
      return NextResponse.json(
        { error: updateError ? "Failed to update appeal" : "This appeal was already decided by someone else" },
        { status: updateError ? 500 : 409 }
      )
    }

    // Carry a final decision on a staged leave grant onto its leave_requests row. The appeal
    // update above is the concurrency guard, so this runs only for the winning reviewer; if
    // it fails, the appeal is put back so the decision can be retried.
    if (stagedLeave && (isFinalApproval || action === "reject")) {
      const leaveUpdate = isFinalApproval
        ? {
            status: "approved",
            approval_stage: "completed",
            current_stage_code: "completed",
            approved_by: scope.userId,
            approved_at: now,
            hr_decision_at: now,
          }
        : {
            status: "rejected",
            approval_stage: "rejected",
            current_stage_code: "rejected",
            rejected_reason: resolutionNote,
            hr_decision_at: now,
          }
      const { data: decidedLeave, error: leaveError } = await dataClient
        .from("leave_requests")
        .update(leaveUpdate)
        .eq("id", stagedLeave.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle()

      if (leaveError || !decidedLeave) {
        log.error({ err: leaveError, leaveRequestId: stagedLeave.id }, "Failed to decide staged leave")
        await dataClient
          .from("attendance_appeals")
          .update({
            status: appeal.status,
            stage: appeal.stage,
            lead_reviewed_by: appeal.lead_reviewed_by,
            lead_reviewed_at: appeal.lead_reviewed_at,
            lead_resolution_note: appeal.lead_resolution_note,
            admin_reviewed_by: appeal.admin_reviewed_by,
            admin_reviewed_at: appeal.admin_reviewed_at,
            admin_resolution_note: appeal.admin_resolution_note,
            reviewed_by: null,
            reviewed_at: null,
            resolution_note: null,
          })
          .eq("id", appeal.id)
        return NextResponse.json(
          { error: "Could not update the leave request. The appeal was left unchanged — please try again." },
          { status: 500 }
        )
      }

      if (isFinalApproval) {
        await recordAttendanceEvent(dataClient, {
          userId: appeal.user_id,
          eventDate: stagedLeave.start_date,
          eventType: "leave_granted",
          toStatus: "on_leave",
          source: "manual",
          comment: resolutionNote || null,
          actorId: scope.userId,
          metadata: {
            leave_request_id: stagedLeave.id,
            leave_type_id: stagedLeave.leave_type_id,
            start_date: stagedLeave.start_date,
            end_date: stagedLeave.end_date,
            days_count: stagedLeave.days_count,
            appeal_id: appeal.id,
          },
        })
      }
    }

    // Event provenance
    const eventType = action === "reject" ? "appeal_rejected" : isFinalApproval ? "appeal_approved" : "appeal_requested"

    await recordAttendanceEvent(dataClient, {
      userId: appeal.user_id,
      eventDate: appeal.appeal_date,
      eventType,
      attendanceRecordId: approvedRecordId,
      fromStatus: appeal.current_status,
      toStatus: isFinalApproval ? appeal.requested_status : appeal.current_status,
      source: "appeal",
      comment: resolutionNote || null,
      actorId: scope.userId,
      metadata: {
        appeal_id: appeal.id,
        requested_status: appeal.requested_status,
        stage: nextStage,
      },
    })

    await writeAuditLog(
      supabase,
      {
        action: action === "approve" ? (isFinalApproval ? "approve" : "endorse") : "reject",
        entityType: "attendance_appeal",
        entityId: appeal.id,
        newValues: {
          user_id: appeal.user_id,
          status: nextStatus,
          stage: nextStage,
          appeal_date: appeal.appeal_date,
          requested_status: appeal.requested_status,
          resolution_note: resolutionNote || null,
        },
        context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/attendance/appeals" },
      },
      { failOpen: true }
    )

    // Notifications
    const appellantName = appellant?.full_name || "Employee"
    const subject = stagedLeave
      ? `${appellantName}'s leave (${stagedLeave.start_date} to ${stagedLeave.end_date})`
      : `${appellantName}'s appeal for ${appeal.appeal_date}`
    if (nextStage === "pending_admin") {
      await notifyAppealReviewers(dataClient, {
        stage: "pending_admin",
        department: appellant?.department ?? null,
        departmentId: appellant?.department_id ?? null,
        appealId: appeal.id,
        actorId: scope.userId,
        title: "Appeal Endorsed by Lead",
        message: `${subject} was endorsed by their Department Lead. Ready for HR approval.`,
      })
    } else if (nextStage === "pending_hr_lead") {
      await notifyAppealReviewers(dataClient, {
        stage: "pending_hr_lead",
        department: appellant?.department ?? null,
        departmentId: appellant?.department_id ?? null,
        appealId: appeal.id,
        actorId: scope.userId,
        title: "Lead Appeal Awaiting HR Lead",
        message: `${subject} was reviewed by Admin and is awaiting your final approval.`,
        priority: "high",
      })
    } else if (isFinalApproval || action === "reject") {
      // Notify employee of final outcome
      const outcome = stagedLeave
        ? isFinalApproval
          ? `Your leave from ${stagedLeave.start_date} to ${stagedLeave.end_date} has received final approval.`
          : `Your leave from ${stagedLeave.start_date} to ${stagedLeave.end_date} has been rejected.${resolutionNote ? ` Note: ${resolutionNote}` : ""}`
        : isFinalApproval
          ? `Your attendance appeal for ${appeal.appeal_date} has received final approval. Status updated to ${appeal.requested_status}.`
          : `Your attendance appeal for ${appeal.appeal_date} has been rejected.${resolutionNote ? ` Note: ${resolutionNote}` : ""}`
      await createNotification({
        p_user_id: appeal.user_id,
        p_type: isFinalApproval ? "approval_granted" : "approval_rejected",
        p_category: "approvals",
        p_title: isFinalApproval ? "Attendance Appeal Approved" : "Attendance Appeal Rejected",
        p_message: outcome,
        p_priority: "normal",
        p_link_url: "/hr/attendance",
        p_actor_id: scope.userId,
        p_entity_type: "attendance_appeal",
        p_entity_id: appeal.id,
      })
    }

    if (isFinalApproval || action === "reject") {
      await notifyAttendanceMail(dataClient, {
        affectedUserId: appeal.user_id,
        actorId: scope.userId,
        date: appeal.appeal_date,
        fromStatus: appeal.current_status,
        toStatus: isFinalApproval ? appeal.requested_status : appeal.current_status,
        decision: isFinalApproval ? "approved" : "rejected",
        requesterComment: appeal.appeal_reason,
        approverComment: resolutionNote || null,
        occurredAt: now,
      })
    }

    return NextResponse.json({
      data: updatedAppeal,
      stage: nextStage,
      status: nextStatus,
      isFinalApproval,
    })
  } catch (err) {
    log.error({ err: String(err) }, "Error in PATCH /api/admin/hr/attendance/appeals")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
