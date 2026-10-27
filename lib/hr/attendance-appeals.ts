import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import {
  ATTENDANCE_STATUS_LABELS,
  deriveUnifiedAttendanceStatus,
  type UnifiedAttendanceStatus,
} from "@/lib/hr/attendance-status"
import type { AttendancePolicy } from "@/lib/org-config"
import { notifyAttendanceMail } from "@/lib/hr/attendance-notify"
import { createNotification } from "@/lib/notifications/create"
import { DEPT_ADMIN_HR } from "@/shared/departments"

const log = logger("attendance-appeals")

type PendingAppealRow = {
  id: string
  user_id: string
  appeal_date: string
  current_status: string
  requested_status: string
  appeal_reason: string | null
}

function statusLabel(status: string): string {
  return ATTENDANCE_STATUS_LABELS[status as UnifiedAttendanceStatus] ?? status
}

/**
 * Closes any pending appeal on days Admin & HR or a lead has just changed directly.
 *
 * Replaces the old `auto_resolve_appeals` DB trigger, which only fired for an
 * AWP/LWP edit and closed the appeal as 'approved'. That left two holes: any
 * other manual edit (IWP, Out of Station, bulk edits, open-ended OOS) left the
 * appeal pending, where a later approval would overwrite the manual status;
 * and 'approved' read as a decision on the employee's stated reason even when
 * the day was set to something else.
 *
 * Every manual closure is now 'resolved', whatever status was set - including
 * the one requested - so the log always shows the day was handled outside the
 * appeal. The note records the status actually set. The employee is told in-app
 * and by email.
 *
 * An edit that leaves the day on the status that was appealed (for example a
 * clock-time correction on a late day) does not count as acting on the appeal.
 *
 * Best-effort: never throws.
 */
export async function resolvePendingAppealsOnManualStatus(
  client: SupabaseClient,
  params: {
    userId: string
    /** Days whose status was set. One for a single edit, many for bulk or OOS ranges. */
    dates: string[]
    status: string
    /** Record id when a single day was edited; null for ranges. */
    attendanceRecordId?: string | null
    comment?: string | null
    actorId?: string | null
  }
): Promise<void> {
  if (params.dates.length === 0) return
  try {
    const { data: pending, error: fetchError } = await client
      .from("attendance_appeals")
      .select("id, user_id, appeal_date, current_status, requested_status, appeal_reason")
      .eq("user_id", params.userId)
      .in("appeal_date", params.dates)
      .eq("status", "pending")
      .returns<PendingAppealRow[]>()
    if (fetchError) {
      log.error({ err: fetchError.message }, "Failed to look up pending appeals")
      return
    }

    for (const appeal of pending ?? []) {
      if (appeal.current_status === params.status) continue

      const now = new Date().toISOString()
      const setText = `Resolved manually: day set to ${statusLabel(params.status)}`
      const note = params.comment?.trim() ? `${setText}. ${params.comment.trim()}` : setText

      const { error } = await client
        .from("attendance_appeals")
        .update({
          status: "resolved",
          resolution_note: note,
          reviewed_by: params.actorId ?? null,
          reviewed_at: now,
          updated_at: now,
        })
        .eq("id", appeal.id)
        .eq("status", "pending")
      if (error) {
        log.error({ err: error.message, appealId: appeal.id }, "Failed to resolve appeal")
        continue
      }

      await recordAttendanceEvent(client, {
        userId: appeal.user_id,
        eventDate: appeal.appeal_date,
        eventType: "appeal_auto_resolved",
        attendanceRecordId: params.attendanceRecordId ?? null,
        fromStatus: appeal.current_status,
        toStatus: params.status,
        source: "manual",
        // `comment` is only what the person typed; the system's wording is kept apart.
        comment: params.comment?.trim() || null,
        actorId: params.actorId ?? null,
        metadata: { appeal_id: appeal.id, requested_status: appeal.requested_status, summary: setText },
      })

      try {
        await client.rpc("create_notification", {
          p_user_id: appeal.user_id,
          p_type: "system",
          p_category: "approvals",
          p_title: "Attendance Appeal Resolved",
          p_message: `Your attendance appeal for ${appeal.appeal_date} was resolved manually by Admin & HR. The day is now ${statusLabel(params.status)}.`,
          p_priority: "normal",
          p_link_url: "/hr/attendance",
          p_actor_id: params.actorId ?? null,
          p_entity_type: "attendance_appeal",
          p_entity_id: appeal.id,
        })
      } catch (notifyErr) {
        log.error({ err: String(notifyErr), appealId: appeal.id }, "Failed to notify employee of resolved appeal")
      }

      await notifyAttendanceMail(client, {
        affectedUserId: appeal.user_id,
        actorId: params.actorId ?? null,
        date: appeal.appeal_date,
        fromStatus: appeal.current_status,
        toStatus: params.status,
        decision: "resolved",
        requesterComment: appeal.appeal_reason,
        approverComment: note,
        occurredAt: now,
      })
    }
  } catch (err) {
    log.error({ err: String(err) }, "Failed to resolve pending appeals")
  }
}

/** The only day statuses an appeal can be raised against (see POST /api/hr/attendance/appeals). */
export const APPEALABLE_DAY_STATUSES = new Set(["absent", "late", "incomplete"])

type DayRecord = {
  clock_in: string | null
  clock_out: string | null
  status: string | null
  waived: boolean | null
}

/**
 * The day's status as it stands now, for comparing with the snapshot an appeal
 * took when it was raised. Holiday, leave and early-closure context are not
 * loaded here; without them a day can only read *worse* than the roster shows,
 * never better, so a check built on this never closes an appeal it should not.
 */
export function liveAppealDayStatus(record: DayRecord | null, date: string, policy: AttendancePolicy): string {
  return deriveUnifiedAttendanceStatus({ record: record ?? null, recordDate: date }, policy)
}

/**
 * Closes pending appeals that a late device sync has made pointless.
 *
 * The clock-in device has gone quiet for hours at a time (18-21 Sep, 28-29 Sep
 * 2026) and then sent its backlog at once. In between, the day reads absent or
 * incomplete, staff appeal it, and when the punches land the day is fine - but
 * the appeal stays pending with its stale snapshot. This runs after every
 * device punch and resolves the day's pending appeals once the day is no longer
 * appealable at all. A day that is still appealable (incomplete that became
 * late, say) is left for a reviewer, who sees the live status in the list.
 *
 * Best-effort: never throws.
 */
export async function closeAppealsMadeMootByDevice(
  client: SupabaseClient,
  params: { userId: string; date: string; policy: AttendancePolicy }
): Promise<void> {
  try {
    const { data: pending } = await client
      .from("attendance_appeals")
      .select("id, current_status")
      .eq("user_id", params.userId)
      .eq("appeal_date", params.date)
      .eq("status", "pending")
      .returns<Array<{ id: string; current_status: string }>>()
    if (!pending || pending.length === 0) return

    const { data: record } = await client
      .from("attendance_records")
      .select("id, clock_in, clock_out, status, waived")
      .eq("user_id", params.userId)
      .eq("date", params.date)
      .maybeSingle<DayRecord & { id: string }>()

    const liveStatus = liveAppealDayStatus(record ?? null, params.date, params.policy)
    if (APPEALABLE_DAY_STATUSES.has(liveStatus)) return

    const now = new Date().toISOString()
    const note = `Resolved automatically: the missing clock-in/out arrived from the device and the day is now ${statusLabel(liveStatus)}.`

    for (const appeal of pending) {
      const { error } = await client
        .from("attendance_appeals")
        .update({ status: "resolved", resolution_note: note, reviewed_by: null, reviewed_at: now, updated_at: now })
        .eq("id", appeal.id)
        .eq("status", "pending")
      if (error) {
        log.error({ err: error.message, appealId: appeal.id }, "Failed to close appeal made moot by device sync")
        continue
      }

      await recordAttendanceEvent(client, {
        userId: params.userId,
        eventDate: params.date,
        eventType: "appeal_auto_resolved",
        attendanceRecordId: record?.id ?? null,
        fromStatus: appeal.current_status,
        toStatus: liveStatus,
        source: "hikvision",
        comment: note,
        actorId: null,
        metadata: { appeal_id: appeal.id, reason: "device_sync" },
      })

      // In-app only: a device backlog can land for thirty-odd people at once,
      // and the outcome is good news that needs no action.
      try {
        await client.rpc("create_notification", {
          p_user_id: params.userId,
          p_type: "system",
          p_category: "approvals",
          p_title: "Attendance Appeal Closed",
          p_message: `Your appeal for ${params.date} is no longer needed: your clock-in/out reached the system late and the day is now ${statusLabel(liveStatus)}.`,
          p_priority: "normal",
          p_link_url: "/hr/attendance",
          p_actor_id: null,
          p_entity_type: "attendance_appeal",
          p_entity_id: appeal.id,
        })
      } catch (notifyErr) {
        log.error({ err: String(notifyErr), appealId: appeal.id }, "Failed to notify employee of closed appeal")
      }
    }
  } catch (err) {
    log.error({ err: String(err) }, "Failed to close appeals made moot by device sync")
  }
}

type DepartmentLeadRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  department: string | null
  lead_departments: string[] | null
}

export type DepartmentLeads = {
  /** Lead ids per department they can endorse appeals for. */
  idsByDepartment: Map<string, string[]>
  /** Display name of a lead per department (first match). */
  nameByDepartment: Map<string, string>
  adminHrLeadIds: string[]
  adminHrLeadName: string | null
}

/**
 * Loads department leads keyed by the departments they actually lead.
 *
 * Mirrors the appeal endorsement check (and `scopeDepartments` in rbac): a
 * non-empty `lead_departments` is the full list, otherwise the lead's own
 * department. Using both would name or notify a lead who then gets a 403.
 */
export async function loadDepartmentLeads(client: SupabaseClient): Promise<DepartmentLeads> {
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name, department, lead_departments")
    .eq("is_department_lead", true)
    .returns<DepartmentLeadRow[]>()
  if (error) log.error({ err: String(error.message) }, "Failed to load department leads")

  const idsByDepartment = new Map<string, string[]>()
  const nameByDepartment = new Map<string, string>()
  for (const lead of data ?? []) {
    const led =
      Array.isArray(lead.lead_departments) && lead.lead_departments.length > 0
        ? lead.lead_departments
        : lead.department
          ? [lead.department]
          : []
    const name = lead.full_name?.trim() || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null
    for (const dept of led) {
      if (!dept) continue
      idsByDepartment.set(dept, [...(idsByDepartment.get(dept) ?? []), lead.id])
      if (name && !nameByDepartment.has(dept)) nameByDepartment.set(dept, name)
    }
  }

  return {
    idsByDepartment,
    nameByDepartment,
    adminHrLeadIds: idsByDepartment.get(DEPT_ADMIN_HR) ?? [],
    adminHrLeadName: nameByDepartment.get(DEPT_ADMIN_HR) ?? null,
  }
}

export type AppealReviewStage = "pending_lead" | "pending_admin" | "pending_hr_lead"

/**
 * In-app notice to whoever must act on an appeal at `stage`. Leads review on
 * their department console (/dept/[dept_id]/...), Admin & HR on /admin.
 *
 * Best-effort: never throws.
 */
export async function notifyAppealReviewers(
  client: SupabaseClient,
  params: {
    stage: AppealReviewStage
    /** Appellant's department and its id — used to find and link the lead. */
    department: string | null
    departmentId: string | null
    appealId: string
    actorId: string
    title: string
    message: string
    priority?: "normal" | "high"
  }
): Promise<void> {
  try {
    let recipientIds: string[] = []
    if (params.stage === "pending_lead") {
      if (params.department) {
        recipientIds = (await loadDepartmentLeads(client)).idsByDepartment.get(params.department) ?? []
      }
    } else if (params.stage === "pending_hr_lead") {
      recipientIds = (await loadDepartmentLeads(client)).adminHrLeadIds
    } else {
      const { data: admins } = await client
        .from("profiles")
        .select("id")
        .in("role", ["admin", "super_admin", "developer"])
        .returns<Array<{ id: string }>>()
      recipientIds = (admins ?? []).map((a) => a.id)
    }

    const linkUrl =
      params.stage === "pending_lead"
        ? params.departmentId
          ? `/dept/${params.departmentId}/hr/attendance?tab=appeals`
          : null
        : "/admin/hr/attendance?tab=appeals"

    for (const recipientId of new Set(recipientIds)) {
      if (recipientId === params.actorId) continue
      await createNotification({
        p_user_id: recipientId,
        p_type: "approval_request",
        p_category: "approvals",
        p_title: params.title,
        p_message: params.message,
        p_priority: params.priority ?? "normal",
        p_link_url: linkUrl,
        p_actor_id: params.actorId,
        p_entity_type: "attendance_appeal",
        p_entity_id: params.appealId,
      })
    }
  } catch (err) {
    log.error({ err: String(err), appealId: params.appealId }, "Failed to notify appeal reviewers")
  }
}

/**
 * A manual (Attendance Manager) sick-leave grant is staged as ONE pending
 * `leave_requests` row plus ONE `admin_manual` appeal dated on the leave's first
 * working day. The leave row is the source of truth for the whole range — the
 * appeal carries it to the Lead's confirmation (the admin's entry is the Admin
 * & HR stage), and
 * approving it never writes `attendance_records` (status derivation reads
 * `on_leave` from the approved leave, so real punches are never overwritten).
 */
export function isStagedLeaveAppeal(appeal: { initiated_by_role?: string | null; requested_status: string }) {
  return appeal.initiated_by_role === "admin_manual" && appeal.requested_status === "on_leave"
}

/**
 * The leave-workflow stage code (see `stageCodeForRole`) mirroring a staged-leave
 * appeal's stage, so the Leave screens label who holds the grant.
 */
export function leaveStageForAppealStage(stage: AppealReviewStage): string {
  return stage === "pending_lead" ? "pending_department_lead" : "pending_admin_hr_lead"
}

export type StagedLeaveRequest = {
  id: string
  leave_type_id: string
  start_date: string
  end_date: string
  days_count: number | null
}

/** The pending manual leave a staged-leave appeal stands for (matched on its first day). */
export async function findStagedLeaveRequest(
  client: SupabaseClient,
  userId: string,
  startDate: string
): Promise<StagedLeaveRequest | null> {
  const { data, error } = await client
    .from("leave_requests")
    .select("id, leave_type_id, start_date, end_date, days_count")
    .eq("user_id", userId)
    .eq("admin_manual", true)
    .eq("status", "pending")
    .eq("start_date", startDate)
    .limit(1)
    .returns<StagedLeaveRequest[]>()
  if (error) {
    log.error({ err: String(error.message), userId, startDate }, "Failed to look up staged leave")
    return null
  }
  return data?.[0] ?? null
}

export type StagingActor = { userId: string; isAdminLike: boolean; scopeMode?: string | null }

export type StagingTarget = {
  department: string | null
  department_id: string | null
  is_department_lead: boolean
  full_name: string | null
}

export async function loadStagingTarget(client: SupabaseClient, userId: string): Promise<StagingTarget | null> {
  const { data } = await client
    .from("profiles")
    .select("department, department_id, is_department_lead, full_name")
    .eq("id", userId)
    .maybeSingle<StagingTarget>()
  return data ?? null
}

/**
 * Two-stage rule for manual attendance changes: whoever makes the change is stage 1
 * and the other side confirms it.
 *
 * - An admin (any admin, including on their own day) is the Admin & HR stage; the
 *   person's Department Lead confirms — or the Admin & HR Lead when the person is a lead.
 * - A Department Lead is the lead stage; Admin & HR confirms (then the Admin & HR Lead
 *   when the person is a lead — see the appeals PATCH route).
 */
export function stagingRoute(
  actor: StagingActor,
  target: StagingTarget | null
): { initiatedByRole: "admin_manual" | "lead_on_behalf"; stage: AppealReviewStage; awaiting: string } {
  const isAdmin = actor.isAdminLike && actor.scopeMode !== "lead"
  if (!isAdmin) return { initiatedByRole: "lead_on_behalf", stage: "pending_admin", awaiting: "Admin & HR" }
  return target?.is_department_lead
    ? { initiatedByRole: "admin_manual", stage: "pending_hr_lead", awaiting: "Admin & HR Lead" }
    : { initiatedByRole: "admin_manual", stage: "pending_lead", awaiting: "Department Lead" }
}

export type StageChangeResult =
  | { ok: true; appealId: string; stage: AppealReviewStage; awaiting: string }
  | { ok: false; status: number; error: string }

/**
 * Stages one manual status change for one day as an appeal instead of writing it.
 * The final approval in the appeals PATCH route writes the day (creating the record
 * when there is none).
 */
export async function stageAttendanceChange(
  client: SupabaseClient,
  params: {
    actor: StagingActor
    userId: string
    date: string
    attendanceRecordId: string | null
    currentStatus: string
    requestedStatus: string
    reason: string
    /** Pass when already loaded (bulk), to skip a profile read per day. */
    target?: StagingTarget | null
    /** Bulk callers send one summary notice per person instead. Default true. */
    notify?: boolean
    /**
     * A period change (open-ended OOS, exemption) applied as a whole on confirmation
     * instead of writing this one day. Needs the 20261027120000 migration.
     */
    change?: { kind: "oos_period" | "exemption"; payload: unknown; summary: string }
  }
): Promise<StageChangeResult> {
  const { data: pending } = await client
    .from("attendance_appeals")
    .select("id, stage")
    .eq("user_id", params.userId)
    .eq("appeal_date", params.date)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle<{ id: string; stage: string | null }>()
  if (pending) {
    const stageLabel = (pending.stage ?? "pending").replace(/_/g, " ")
    return {
      ok: false,
      status: 409,
      error: `An alteration or appeal is already pending for ${params.date} (Stage: ${stageLabel}). Please review it in the Appeals tab.`,
    }
  }

  const target = params.target !== undefined ? params.target : await loadStagingTarget(client, params.userId)
  const route = stagingRoute(params.actor, target)
  const now = new Date().toISOString()
  const firstStage =
    route.initiatedByRole === "admin_manual"
      ? {
          admin_reviewed_by: params.actor.userId,
          admin_reviewed_at: now,
          admin_resolution_note: params.reason,
        }
      : {
          lead_reviewed_by: params.actor.userId,
          lead_reviewed_at: now,
          lead_resolution_note: params.reason,
        }

  const { data: staged, error } = await client
    .from("attendance_appeals")
    .insert({
      attendance_record_id: params.attendanceRecordId,
      user_id: params.userId,
      appeal_date: params.date,
      current_status: params.currentStatus,
      requested_status: params.requestedStatus,
      appeal_reason: params.reason,
      status: "pending",
      stage: route.stage,
      initiated_by_role: route.initiatedByRole,
      created_by: params.actor.userId,
      ...firstStage,
      ...(params.change ? { change_kind: params.change.kind, change_payload: params.change.payload } : {}),
    })
    .select("id")
    .single<{ id: string }>()

  if (error || !staged) {
    // A pending appeal created in the meantime trips the one-pending-per-day index.
    if (error?.code === "23505") {
      return { ok: false, status: 409, error: `An alteration or appeal is already pending for ${params.date}.` }
    }
    log.error({ err: String(error?.message), userId: params.userId, date: params.date }, "Failed to stage change")
    return { ok: false, status: 500, error: "Failed to stage alteration" }
  }

  await recordAttendanceEvent(client, {
    userId: params.userId,
    eventDate: params.date,
    eventType: "manual_update",
    attendanceRecordId: params.attendanceRecordId,
    fromStatus: params.currentStatus,
    toStatus: params.requestedStatus,
    source: "manual",
    comment: params.reason,
    actorId: params.actor.userId,
    metadata: { appeal_id: staged.id, staged_stage: route.stage },
  })

  if (params.notify !== false) {
    await notifyAppealReviewers(client, {
      stage: route.stage,
      department: target?.department ?? null,
      departmentId: target?.department_id ?? null,
      appealId: staged.id,
      actorId: params.actor.userId,
      title: "Attendance Alteration Staged",
      message: params.change
        ? `${params.change.summary} for ${target?.full_name ?? "an employee"} requires your confirmation.`
        : `An attendance alteration to ${statusLabel(params.requestedStatus)} for ${target?.full_name ?? "an employee"} on ${params.date} requires your confirmation.`,
    })
  }

  return { ok: true, appealId: staged.id, stage: route.stage, awaiting: route.awaiting }
}
