import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { parseJsonBody } from "@/lib/api/parse-body"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireApiAdminScope, getScopedDepartments, type AdminScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import { notifyAttendanceMail } from "@/lib/hr/attendance-notify"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { validateLwpAwpMonthlyQuota } from "@/lib/hr/attendance-quota"
import { applyExemptionChange, type ExemptionChange } from "@/lib/hr/exemptions"
import { openOosPeriod, type OosPeriodChange } from "@/lib/hr/oos-materialize"
import {
  appealReviewBlock,
  canOverrideAppeal,
  findStagedLeaveRequest,
  isStagedLeaveAppeal,
  liveAppealDayStatus,
  loadDepartmentLeads,
  notifyAppealReviewers,
  type StagedLeaveRequest,
} from "@/lib/hr/attendance-appeals"
import { DEPT_ADMIN_HR } from "@/shared/departments"
import { logger } from "@/lib/logger"
import { createNotification } from "@/lib/notifications/create"

const log = logger("admin-hr-attendance-appeals")

const APPEAL_COLUMNS =
  "id, attendance_record_id, user_id, appeal_date, current_status, requested_status, appeal_reason, status, stage, initiated_by_role, created_by, lead_reviewed_by, lead_reviewed_at, lead_resolution_note, admin_reviewed_by, admin_reviewed_at, admin_resolution_note, reviewed_by, reviewed_at, resolution_note, created_at, updated_at, change_kind, change_payload, batch_id, overridden_by, overridden_at, override_reason, overridden_stage"
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
  batch_id?: string | null
  overridden_by?: string | null
  overridden_by_name?: string | null
  overridden_at?: string | null
  override_reason?: string | null
  overridden_stage?: string | null
  /** Why the caller may not approve or reject this pending appeal; null when they may. */
  review_block: string | null
  /** Whether the caller may override this pending appeal. */
  can_override: boolean
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
  change_kind?: "oos_period" | "exemption" | null
  change_payload?: unknown
  batch_id?: string | null
  overridden_by?: string | null
  overridden_at?: string | null
  override_reason?: string | null
  overridden_stage?: string | null
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
      .select(APPEAL_COLUMNS)
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

    let rows = appeals ?? []
    if (scope.scopeMode === "lead") {
      // A lead's console shows the lead side only: admin-side work stays on the admin page.
      rows = rows.filter((r) => !(r.status === "pending" && r.stage === "pending_admin"))
      // The Admin & HR Lead also approves staff of departments with no lead.
      if (scope.leadDepartments.includes(DEPT_ADMIN_HR) && (statusParam === "all" || statusParam === "pending")) {
        const { data: noLead } = await dataClient
          .from("attendance_appeals")
          .select(APPEAL_COLUMNS)
          .eq("status", "pending")
          .eq("stage", "pending_hr_lead")
          .returns<AppealRow[]>()
        const seen = new Set(rows.map((r) => r.id))
        rows = [...rows, ...(noLead ?? []).filter((r) => !seen.has(r.id))]
      }
    }
    if (rows.length === 0) return NextResponse.json({ data: [] })

    // Fetch profiles for enrichment (appellant, creator, reviewers)
    const userIdsToFetch = new Set<string>()
    for (const r of rows) {
      if (r.user_id) userIdsToFetch.add(r.user_id)
      if (r.created_by) userIdsToFetch.add(r.created_by)
      if (r.lead_reviewed_by) userIdsToFetch.add(r.lead_reviewed_by)
      if (r.admin_reviewed_by) userIdsToFetch.add(r.admin_reviewed_by)
      if (r.reviewed_by) userIdsToFetch.add(r.reviewed_by)
      if (r.overridden_by) userIdsToFetch.add(r.overridden_by)
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
        overridden_by_name: resolveProfileName(r.overridden_by),
        reviewer_name: r.status === "pending" ? null : resolveProfileName(r.reviewed_by),
        review_block: r.status === "pending" ? appealReviewBlock(scope, r, department || null) : null,
        can_override: r.status === "pending" && canOverrideAppeal(scope),
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

const ReviewAppealSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    // A range staged as one batch is decided in one request.
    ids: z.array(z.string().trim().min(1)).min(1).max(62).optional(),
    action: z.enum(["approve", "reject", "override"]),
    resolution_note: z.string().nullable().optional(),
  })
  .refine((body) => Boolean(body.id || body.ids), { message: "id or ids is required" })

type ReviewAction = "approve" | "reject" | "override"
type NextStage = "pending_lead" | "pending_admin" | "pending_hr_lead" | "approved" | "rejected"

type Appellant = {
  id: string
  department: string | null
  department_id: string | null
  is_department_lead: boolean
  full_name: string | null
}

type Decided = {
  appeal: AppealRow
  nextStage: NextStage
  isFinalApproval: boolean
  stagedLeave: StagedLeaveRequest | null
}

/**
 * Decides one appeal and writes everything it touches except notifications, which the
 * PATCH handler sends once per person so a decided range is one notice, not one per day.
 */
async function decideAppeal(
  ctx: {
    dataClient: SupabaseClient
    supabase: Parameters<typeof writeAuditLog>[0]
    scope: AdminScope
  },
  appeal: AppealRow,
  action: ReviewAction,
  resolutionNote: string
): Promise<{ ok: true; decided: Decided } | { ok: false; status: number; error: string }> {
  const { dataClient, supabase, scope } = ctx

  // A staged sick-leave grant: the appeal decides the linked leave_requests row.
  const stagedLeave = isStagedLeaveAppeal(appeal)
    ? await findStagedLeaveRequest(dataClient, appeal.user_id, appeal.appeal_date)
    : null
  if (isStagedLeaveAppeal(appeal) && !stagedLeave) {
    return {
      ok: false,
      status: 409,
      error: "The leave this appeal stands for is no longer pending. It may have been removed or edited.",
    }
  }

  const currentStage = appeal.stage || "pending_lead"
  const now = new Date().toISOString()
  let isFinalApproval = false
  let nextStage: NextStage = "approved"
  let nextStatus: "pending" | "approved" | "rejected" = "approved"
  const updates: Record<string, unknown> = { updated_at: now }

  if (action === "override") {
    // Recorded on its own columns so the history never shows it as an endorsement.
    updates.overridden_by = scope.userId
    updates.overridden_at = now
    updates.override_reason = resolutionNote
    updates.overridden_stage = currentStage
    isFinalApproval = true
  } else if (currentStage === "pending_lead") {
    // ── Lead side: the employee's own Department Lead ──
    updates.lead_reviewed_by = scope.userId
    updates.lead_reviewed_at = now
    updates.lead_resolution_note = resolutionNote || null

    if (action === "reject") {
      nextStatus = "rejected"
      nextStage = "rejected"
    } else if (appeal.initiated_by_role === "admin_manual") {
      // An admin's change already filled the admin side, so the lead's confirmation is final.
      isFinalApproval = true
    } else {
      nextStatus = "pending"
      nextStage = "pending_admin"
    }
  } else if (currentStage === "pending_admin") {
    // ── Admin side: any admin ──
    updates.admin_reviewed_by = scope.userId
    updates.admin_reviewed_at = now
    updates.admin_resolution_note = resolutionNote || null

    if (action === "reject") {
      nextStatus = "rejected"
      nextStage = "rejected"
    } else {
      isFinalApproval = true
    }
  } else {
    // ── Admin & HR Lead: staff of a department with no lead (and lead appeals staged
    //    before the two-sides rule) ──
    if (action === "reject") {
      nextStatus = "rejected"
      nextStage = "rejected"
    } else {
      isFinalApproval = true
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

  // A final approval writes attendance_records. A staged leave grant is the exception: the
  // approved leave_requests row (updated below) derives on_leave for its whole range,
  // without overwriting real punches.
  if (isFinalApproval && !stagedLeave && !appeal.change_kind) {
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
      return { ok: false, status: 403, error: quotaCheck.error ?? "Monthly permission limit reached" }
    }

    const { data: upserted, error: upsertError } = await dataClient
      .from("attendance_records")
      .upsert(
        {
          user_id: appeal.user_id,
          date: appeal.appeal_date,
          status: appeal.requested_status,
          // Derivation reads waived before most statuses, so keep it in step either way.
          waived: appeal.requested_status === "waiver",
          manual_comment:
            action === "override"
              ? `Override: ${resolutionNote}`
              : resolutionNote || `Appeal approved: ${appeal.requested_status}`,
          source: "manual",
        },
        { onConflict: "user_id,date" }
      )
      .select("id")
      .maybeSingle<{ id: string }>()

    if (upsertError) {
      log.error({ err: upsertError }, "Failed to upsert attendance record on final approval")
      return { ok: false, status: 500, error: "Could not update the attendance record. Appeal was left unchanged." }
    }
    if (upserted?.id) approvedRecordId = upserted.id
  }

  const { data: updatedAppeal, error: updateError } = await dataClient
    .from("attendance_appeals")
    .update(updates)
    .eq("id", appeal.id)
    .eq("status", "pending")
    .select()
    .maybeSingle()

  if (updateError || !updatedAppeal) {
    log.error({ err: updateError }, "Failed to update appeal")
    return updateError
      ? { ok: false, status: 500, error: "Failed to update appeal" }
      : { ok: false, status: 409, error: "This appeal was already decided by someone else" }
  }

  // Puts the appeal back to pending when its follow-on write fails, so it can be retried.
  const revertAppeal = () =>
    dataClient
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
        ...(action === "override"
          ? { overridden_by: null, overridden_at: null, override_reason: null, overridden_stage: null }
          : {}),
      })
      .eq("id", appeal.id)

  // A confirmed period change (open-ended OOS, exemption) is applied as a whole. It runs
  // after the appeal update: applying OOS closes pending appeals on its days, which would
  // otherwise include this one.
  if (isFinalApproval && appeal.change_kind) {
    const applied =
      appeal.change_kind === "oos_period"
        ? await openOosPeriod(dataClient, appeal.user_id, appeal.change_payload as OosPeriodChange, scope.userId)
        : await applyExemptionChange(dataClient, appeal.user_id, appeal.change_payload as ExemptionChange, scope.userId)
    if (applied.error) {
      log.error({ err: applied.error, appealId: appeal.id }, "Failed to apply confirmed period change")
      await revertAppeal()
      return { ok: false, status: 500, error: `${applied.error}. The appeal was left unchanged — please try again.` }
    }
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
      await revertAppeal()
      return {
        ok: false,
        status: 500,
        error: "Could not update the leave request. The appeal was left unchanged — please try again.",
      }
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

  await recordAttendanceEvent(dataClient, {
    userId: appeal.user_id,
    eventDate: appeal.appeal_date,
    eventType: action === "reject" ? "appeal_rejected" : isFinalApproval ? "appeal_approved" : "appeal_requested",
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
      ...(action === "override" ? { override: true, overridden_stage: currentStage } : {}),
    },
  })

  await writeAuditLog(
    supabase,
    {
      action:
        action === "override"
          ? "override"
          : action === "approve"
            ? isFinalApproval
              ? "approve"
              : "endorse"
            : "reject",
      entityType: "attendance_appeal",
      entityId: appeal.id,
      newValues: {
        user_id: appeal.user_id,
        status: nextStatus,
        stage: nextStage,
        appeal_date: appeal.appeal_date,
        requested_status: appeal.requested_status,
        resolution_note: resolutionNote || null,
        ...(action === "override" ? { overridden_stage: currentStage } : {}),
      },
      context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/attendance/appeals" },
    },
    { failOpen: true }
  )

  return { ok: true, decided: { appeal, nextStage, isFinalApproval, stagedLeave } }
}

function dateLabel(dates: string[]): string {
  const sorted = [...dates].sort()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return first === last ? first : `${first} to ${last} (${sorted.length} days)`
}

/** One set of notices for one person's decided appeals (a single day or a range). */
async function notifyDecision(
  dataClient: SupabaseClient,
  scope: AdminScope,
  appellant: Appellant | null,
  decided: Decided[],
  action: ReviewAction,
  resolutionNote: string
) {
  const first = decided[0]
  const appeal = first.appeal
  const appellantName = appellant?.full_name || "Employee"
  const when = dateLabel(decided.map((d) => d.appeal.appeal_date))
  const subject = first.stagedLeave
    ? `${appellantName}'s leave (${first.stagedLeave.start_date} to ${first.stagedLeave.end_date})`
    : `${appellantName}'s appeal for ${when}`

  if (first.nextStage === "pending_admin") {
    await notifyAppealReviewers(dataClient, {
      stage: "pending_admin",
      department: appellant?.department ?? null,
      departmentId: appellant?.department_id ?? null,
      appealId: appeal.id,
      actorId: scope.userId,
      title: "Appeal Endorsed by Lead",
      message: `${subject} was endorsed by their Department Lead. Ready for admin approval.`,
    })
    return
  }

  const approved = first.isFinalApproval
  const outcome = first.stagedLeave
    ? approved
      ? `Your leave from ${first.stagedLeave.start_date} to ${first.stagedLeave.end_date} has received final approval.`
      : `Your leave from ${first.stagedLeave.start_date} to ${first.stagedLeave.end_date} has been rejected.${resolutionNote ? ` Note: ${resolutionNote}` : ""}`
    : approved
      ? `Your attendance for ${when} has received final approval${action === "override" ? " (by override)" : ""}. Status updated to ${appeal.requested_status}.`
      : `Your attendance appeal for ${when} has been rejected.${resolutionNote ? ` Note: ${resolutionNote}` : ""}`
  await createNotification({
    p_user_id: appeal.user_id,
    p_type: approved ? "approval_granted" : "approval_rejected",
    p_category: "approvals",
    p_title: approved ? "Attendance Appeal Approved" : "Attendance Appeal Rejected",
    p_message: outcome,
    p_priority: "normal",
    p_link_url: "/hr/attendance",
    p_actor_id: scope.userId,
    p_entity_type: "attendance_appeal",
    p_entity_id: appeal.id,
  })

  // An override tells whoever's step it skipped, and the Admin & HR Lead, in-app and by email.
  let skippedIds: string[] = []
  if (action === "override") {
    const leads = await loadDepartmentLeads(dataClient)
    const stage = appeal.stage || "pending_lead"
    if (stage === "pending_lead" && appellant?.department) {
      skippedIds = leads.idsByDepartment.get(appellant.department) ?? []
    }
    const recipients = new Set([...skippedIds, ...leads.adminHrLeadIds])
    recipients.delete(scope.userId)
    recipients.delete(appeal.user_id)
    for (const recipientId of recipients) {
      await createNotification({
        p_user_id: recipientId,
        p_type: "system",
        p_category: "approvals",
        p_title: "Attendance Approval Overridden",
        p_message: `${subject} was approved by override. Reason: ${resolutionNote}`,
        p_priority: "high",
        p_link_url: "/admin/hr/attendance?tab=appeals",
        p_actor_id: scope.userId,
        p_entity_type: "attendance_appeal",
        p_entity_id: appeal.id,
      })
    }
  }

  await notifyAttendanceMail(dataClient, {
    affectedUserId: appeal.user_id,
    actorId: scope.userId,
    date: when,
    fromStatus: appeal.current_status,
    toStatus: approved ? appeal.requested_status : appeal.current_status,
    decision: action === "override" ? "overridden" : approved ? "approved" : "rejected",
    requesterComment: appeal.appeal_reason,
    approverComment: resolutionNote || null,
    occurredAt: new Date().toISOString(),
    alsoNotifyUserIds: skippedIds,
  })
}

export async function PATCH(request: NextRequest) {
  try {
    const scopeResult = await requireApiAdminScope()
    if (!scopeResult.ok) return scopeResult.response
    const { scope, supabase } = scopeResult

    const parsed = await parseJsonBody(request, ReviewAppealSchema)
    if (!parsed.ok) return parsed.response
    const action = parsed.data.action
    const resolutionNote = parsed.data.resolution_note?.trim() ?? ""
    const ids = [...new Set(parsed.data.ids ?? [parsed.data.id as string])]

    if (action === "reject" && !resolutionNote) {
      return NextResponse.json({ error: "resolution_note is required when rejecting" }, { status: 400 })
    }
    if (action === "override") {
      if (!canOverrideAppeal(scope)) {
        return NextResponse.json({ error: "Only admins can override an approval." }, { status: 403 })
      }
      if (!resolutionNote) {
        return NextResponse.json({ error: "A reason is required to override." }, { status: 400 })
      }
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)

    const { data: fetched, error: fetchError } = await dataClient
      .from("attendance_appeals")
      .select(APPEAL_COLUMNS)
      .in("id", ids)
      .returns<AppealRow[]>()

    if (fetchError || !fetched || fetched.length !== ids.length) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 })
    }
    const appeals = [...fetched].sort((a, b) => a.appeal_date.localeCompare(b.appeal_date))

    const { data: appellantRows } = await dataClient
      .from("profiles")
      .select("id, department, department_id, is_department_lead, full_name")
      .in("id", [...new Set(appeals.map((a) => a.user_id))])
      .returns<Appellant[]>()
    const appellants = new Map((appellantRows ?? []).map((p) => [p.id, p]))

    // Check every day before writing any, so a range is decided whole or not at all.
    for (const appeal of appeals) {
      if (appeal.status !== "pending") {
        return NextResponse.json(
          { error: `The appeal for ${appeal.appeal_date} is already ${appeal.status}` },
          { status: 409 }
        )
      }
      if (action !== "override") {
        const blocked = appealReviewBlock(scope, appeal, appellants.get(appeal.user_id)?.department ?? null)
        if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })
      }
    }

    const decidedByUser = new Map<string, Decided[]>()
    for (const appeal of appeals) {
      const result = await decideAppeal({ dataClient, supabase, scope }, appeal, action, resolutionNote)
      if (!result.ok) {
        const done = [...decidedByUser.values()].reduce((sum, list) => sum + list.length, 0)
        return NextResponse.json(
          { error: done > 0 ? `${result.error} ${done} day(s) were decided before this.` : result.error },
          { status: result.status }
        )
      }
      decidedByUser.set(appeal.user_id, [...(decidedByUser.get(appeal.user_id) ?? []), result.decided])
    }

    for (const [userId, decided] of decidedByUser) {
      await notifyDecision(dataClient, scope, appellants.get(userId) ?? null, decided, action, resolutionNote)
    }

    const last = appeals.length === 1 ? decidedByUser.get(appeals[0].user_id)?.[0] : null
    return NextResponse.json({
      decided: appeals.length,
      stage: last?.nextStage ?? null,
      isFinalApproval: last ? last.isFinalApproval : action !== "reject",
    })
  } catch (err) {
    log.error({ err: String(err) }, "Error in PATCH /api/admin/hr/attendance/appeals")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
