import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import {
  ATTENDANCE_STATUS_LABELS,
  deriveUnifiedAttendanceStatus,
  type UnifiedAttendanceStatus,
} from "@/lib/hr/attendance-status"
import type { AttendancePolicy } from "@/lib/org-config"
import { createNotification } from "@/lib/notifications/create"
import { DEPT_ADMIN_HR, isSameDepartment } from "@/shared/departments"
import { toLocalISODate } from "@/lib/utils/date"
import { expandDepartmentScopeForQuery, type AdminScope } from "@/lib/admin/rbac"

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
 * now, and by email in the next appeal summary (sendAppealDecisionDigest).
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
        // Stamped as already emailed: the device fixed the day, so the appeal summary skips it.
        .update({
          status: "resolved",
          resolution_note: note,
          reviewed_by: null,
          reviewed_at: now,
          updated_at: now,
          decision_emailed_at: now,
        })
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
    } else {
      // Both second-stage values belong to the Admin & HR Lead and whoever they have
      // delegated to, never to every holder of the admin role.
      recipientIds = await loadAdminHrApproverIds(client)
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

/**
 * A day's status is never changed first from the admin side. Whoever holds the admin
 * role (even with HR edit access) cannot start a single-day change: it starts with the
 * employee's department lead, from their department console, and the Admin & HR Lead
 * decides it. Returns the message to refuse an admin-scope caller with, or null.
 */
export function leadFirstBlock(actor: { isAdminLike: boolean; scopeMode?: string | null }): string | null {
  const isAdminScope = actor.isAdminLike && actor.scopeMode !== "lead"
  return isAdminScope
    ? "Attendance changes start with the employee's department lead. Ask the lead to make this change from their department console."
    : null
}

export function stagedLeaveEntryKey(userId: string, startDate: string) {
  return `${userId}|${startDate}`
}

/**
 * Who entered a manual leave and when. The admin's entry is recorded on the
 * `admin_manual` appeal (admin_reviewed_by/at), not on the leave row, so Leave
 * screens read it from here. Keyed by `stagedLeaveEntryKey(user_id, start_date)`.
 */
export async function findStagedLeaveAdminEntries(
  client: SupabaseClient,
  leaves: Array<{ user_id: string; start_date: string }>
): Promise<Map<string, { reviewerId: string; reviewedAt: string | null }>> {
  const entries = new Map<string, { reviewerId: string; reviewedAt: string | null }>()
  if (leaves.length === 0) return entries
  const userIds = Array.from(new Set(leaves.map((l) => l.user_id)))
  const dates = Array.from(new Set(leaves.map((l) => l.start_date)))
  const { data, error } = await client
    .from("attendance_appeals")
    .select("user_id, appeal_date, admin_reviewed_by, admin_reviewed_at")
    .eq("initiated_by_role", "admin_manual")
    .eq("requested_status", "on_leave")
    .in("user_id", userIds)
    .in("appeal_date", dates)
    .returns<
      Array<{
        user_id: string
        appeal_date: string
        admin_reviewed_by: string | null
        admin_reviewed_at: string | null
      }>
    >()
  if (error) {
    log.error({ err: String(error.message) }, "Failed to look up staged leave admin entries")
    return entries
  }
  for (const row of data ?? []) {
    if (!row.admin_reviewed_by) continue
    entries.set(stagedLeaveEntryKey(row.user_id, row.appeal_date), {
      reviewerId: row.admin_reviewed_by,
      reviewedAt: row.admin_reviewed_at,
    })
  }
  return entries
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
 * Two sides approve every attendance change: the admin side (any admin, working
 * from the admin page) and the lead side (the employee's own Department Lead). Who
 * starts the change fills their own side; the other side approves it.
 *
 * - An admin's change (including on their own day) fills the admin side, so the
 *   person's lead confirms. A lead confirms a change to their own day.
 * - A lead's change fills the lead side, so an admin approves.
 * - Staff in a department with no lead: the Admin & HR Lead approves alone.
 */
export function stagingRoute(
  actor: StagingActor,
  target: StagingTarget | null,
  departmentHasLead: boolean
): { initiatedByRole: "admin_manual" | "lead_on_behalf"; stage: AppealReviewStage; awaiting: string } {
  const isAdmin = actor.isAdminLike && actor.scopeMode !== "lead"
  if (!isAdmin) return { initiatedByRole: "lead_on_behalf", stage: "pending_admin", awaiting: "Admin" }
  return target?.is_department_lead || departmentHasLead
    ? { initiatedByRole: "admin_manual", stage: "pending_lead", awaiting: "Department Lead" }
    : { initiatedByRole: "admin_manual", stage: "pending_hr_lead", awaiting: "Admin & HR Lead" }
}

/** First stage of an employee's own appeal (made on /attendance). */
export function employeeAppealStage(
  appellant: { is_department_lead: boolean; department?: string | null } | null,
  departmentHasLead: boolean
): AppealReviewStage {
  // Admin & HR's own staff (and its lead) have one stage: the Admin & HR Lead or her
  // delegate. Their department lead IS the Admin & HR Lead, so a lead step would be
  // the same person twice.
  if (appellant && isSameDepartment(appellant.department, DEPT_ADMIN_HR)) return "pending_hr_lead"
  // A lead is their own lead side, so only the Admin & HR Lead stage is left.
  if (appellant?.is_department_lead) return "pending_admin"
  return departmentHasLead ? "pending_lead" : "pending_hr_lead"
}

/** Whether anyone leads `department`. */
export async function departmentHasLead(client: SupabaseClient, department: string | null): Promise<boolean> {
  if (!department) return false
  const leads = await loadDepartmentLeads(client)
  return (leads.idsByDepartment.get(department) ?? []).length > 0
}

export type AppealReviewer = Pick<
  AdminScope,
  "userId" | "department" | "isDepartmentLead" | "leadDepartments" | "isAdminLike" | "scopeMode"
> & { role?: string }

export type ReviewableAppeal = {
  stage?: string | null
  initiated_by_role?: string | null
  created_by?: string | null
  lead_reviewed_by?: string | null
  /** The employee the appeal is about. */
  user_id?: string | null
  created_at?: string | null
  lead_reviewed_at?: string | null
}

/**
 * Who holds which approval position right now, loaded once per request
 * (loadAppealRoutingContext) so the review rules below stay pure.
 */
export type AppealRoutingContext = {
  /** The Admin & HR Lead(s): leads of the Admin and HR department. */
  adminHrLeadIds: string[]
  /** Department lead ids by department name. */
  leadIdsByDepartment: Record<string, string[]>
  /** Leads on approved leave today. */
  onLeaveIds: string[]
  /** Admin & HR Lead(s) that have at least one active delegate. */
  leadsWithDelegate: string[]
  /** The Admin & HR Lead(s) the reviewer is an active delegate of. */
  actingForLeadIds: string[]
}

export const EMPTY_APPEAL_ROUTING: AppealRoutingContext = {
  adminHrLeadIds: [],
  leadIdsByDepartment: {},
  onLeaveIds: [],
  leadsWithDelegate: [],
  actingForLeadIds: [],
}

/** An approval is stuck after this many working days with no decision. */
export const STUCK_AFTER_WORKING_DAYS = 5

function leadsDepartment(reviewer: AppealReviewer, department: string | null): boolean {
  if (!reviewer.isDepartmentLead || !department) return false
  const leadDepts =
    reviewer.leadDepartments.length > 0 ? reviewer.leadDepartments : reviewer.department ? [reviewer.department] : []
  return expandDepartmentScopeForQuery(leadDepts).includes(department)
}

/**
 * Why `reviewer` may not decide the Admin & HR Lead's stage of `appeal`, or null.
 *
 * The stage belongs to a person, the Admin & HR Lead, and to whoever she has
 * delegated to — never to a role. Nobody decides their own appeal here, with two
 * exceptions that carry an audit mark ("self-approved", listed monthly for the MD):
 * the Admin & HR Lead (nobody sits above her in this chain), and her delegate while
 * every lead they act for is on approved leave. A delegate can never decide the
 * Admin & HR Lead's own appeal.
 */
function adminHrLeadStageBlock(
  reviewer: AppealReviewer,
  appeal: ReviewableAppeal,
  routing: AppealRoutingContext
): string | null {
  const isLead = routing.adminHrLeadIds.includes(reviewer.userId)
  const actingFor = routing.actingForLeadIds
  if (!isLead && actingFor.length === 0) {
    return "Only the Admin & HR Lead, or the person they have delegated to, can decide this."
  }
  if (appeal.lead_reviewed_by === reviewer.userId) {
    return "You endorsed this as lead, so someone else must approve it."
  }
  if (appeal.user_id && routing.adminHrLeadIds.includes(appeal.user_id) && !isLead) {
    return "Only the Admin & HR Lead can decide their own appeal."
  }
  if (appeal.user_id && appeal.user_id === reviewer.userId && !isLead) {
    const away = actingFor.every((leadId) => routing.onLeaveIds.includes(leadId))
    if (!away) return "You cannot decide your own appeal while the Admin & HR Lead is available."
  }
  return null
}

/**
 * Why `reviewer` may not approve or reject `appeal` at its current stage, or null
 * when they may. The PATCH route enforces it and the list sends it to the page.
 *
 * Each stage belongs to one side, taken from the employee's record, never from a
 * role: the lead stage only to the employee's real Department Lead, the second stage
 * (pending_admin, or pending_hr_lead for staff of a department with no lead and for
 * Admin & HR's own staff) only to the Admin & HR Lead and their delegates. Whoever
 * made a change cannot also confirm it, and the lead who endorsed an appeal cannot
 * also approve it at the second stage. Anything else goes through an override, which
 * is only open once an approval is stuck.
 */
export function appealReviewBlock(
  reviewer: AppealReviewer,
  appeal: ReviewableAppeal,
  appellantDepartment: string | null,
  routing: AppealRoutingContext = EMPTY_APPEAL_ROUTING
): string | null {
  if (appeal.created_by === reviewer.userId && appeal.initiated_by_role !== "employee") {
    return "You made this change, so someone else must confirm it."
  }

  const stage = appeal.stage || "pending_lead"
  if (stage === "pending_lead") {
    return leadsDepartment(reviewer, appellantDepartment)
      ? null
      : `Only the Department Lead for ${appellantDepartment || "this department"} can confirm this.`
  }
  if (stage === "pending_admin" || stage === "pending_hr_lead") {
    return adminHrLeadStageBlock(reviewer, appeal, routing)
  }
  return "This appeal is no longer pending."
}

/** Whole working days (Mon-Fri, West Africa Time) after `from` up to and including `now`. */
export function workingDaysSince(from: string | Date, now: Date): number {
  const WAT_OFFSET_MS = 60 * 60 * 1000
  const dayStart = (value: Date) => {
    const shifted = new Date(value.getTime() + WAT_OFFSET_MS)
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  }
  const start = dayStart(typeof from === "string" ? new Date(from) : from)
  const end = dayStart(now)
  let count = 0
  for (let day = start + 86_400_000; day <= end; day += 86_400_000) {
    const weekday = new Date(day).getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
  }
  return count
}

function stageOwnerIds(appeal: ReviewableAppeal, department: string | null, routing: AppealRoutingContext): string[] {
  const stage = appeal.stage || "pending_lead"
  if (stage === "pending_lead") return department ? (routing.leadIdsByDepartment[department] ?? []) : []
  return routing.adminHrLeadIds
}

/**
 * Why an approval is stuck, or null while it is not. Stuck means the owner of the
 * current step has had it for STUCK_AFTER_WORKING_DAYS working days without deciding,
 * or every owner of the step is on approved leave with no delegate. Only a stuck
 * approval can be overridden.
 */
export function appealStuckReason(
  appeal: ReviewableAppeal,
  department: string | null,
  routing: AppealRoutingContext,
  now: Date
): string | null {
  const stage = appeal.stage || "pending_lead"
  const owners = stageOwnerIds(appeal, department, routing)
  if (
    owners.length > 0 &&
    owners.every((id) => routing.onLeaveIds.includes(id) && !routing.leadsWithDelegate.includes(id))
  ) {
    return "The approver is on leave and has no delegate."
  }
  const enteredAt = stage === "pending_lead" ? appeal.created_at : (appeal.lead_reviewed_at ?? appeal.created_at)
  if (enteredAt && workingDaysSince(enteredAt, now) >= STUCK_AFTER_WORKING_DAYS) {
    return `Waiting ${STUCK_AFTER_WORKING_DAYS}+ working days with no decision.`
  }
  return null
}

/**
 * Why `reviewer` may not override `appeal`, or null when they may. Override is the
 * way out of a stuck approval, not a second way to approve: super admins and
 * developers only, and only once the approval is stuck. It needs a reason, is
 * recorded as an override, and tells whoever was skipped.
 */
export function overrideBlock(
  reviewer: Pick<AppealReviewer, "role" | "isAdminLike" | "scopeMode">,
  appeal: ReviewableAppeal,
  department: string | null,
  routing: AppealRoutingContext,
  now: Date
): string | null {
  const isSeniorAdmin = reviewer.role === "super_admin" || reviewer.role === "developer"
  if (!isSeniorAdmin || reviewer.scopeMode === "lead") return "Only a super admin or developer can override."
  const stuck = appealStuckReason(appeal, department, routing, now)
  if (!stuck) {
    return `Override opens once an approval is stuck: ${STUCK_AFTER_WORKING_DAYS} working days with no decision, or the approver on leave with no delegate.`
  }
  return null
}

/** The Admin & HR Lead(s) plus anyone they have an active delegation to. */
export async function loadAdminHrApproverIds(client: SupabaseClient): Promise<string[]> {
  const leads = await loadDepartmentLeads(client)
  const ids = new Set(leads.adminHrLeadIds)
  if (leads.adminHrLeadIds.length > 0) {
    const { data } = await client
      .from("admin_edit_grants")
      .select("user_id, valid_until")
      .in("delegated_from", leads.adminHrLeadIds)
      .in("route_key", ["hr.attendance", "hr.main"])
      .is("revoked_at", null)
      .returns<Array<{ user_id: string; valid_until: string | null }>>()
    const now = Date.now()
    for (const row of data ?? []) {
      if (!row.valid_until || new Date(row.valid_until).getTime() > now) ids.add(row.user_id)
    }
  }
  return Array.from(ids)
}

/**
 * Loads who holds each approval position today. `reviewerId` is the person looking at
 * (or deciding) appeals; it fills `actingForLeadIds`. A failed read leaves a part empty,
 * which blocks rather than permits.
 */
export async function loadAppealRoutingContext(
  client: SupabaseClient,
  reviewerId: string | null,
  now: Date = new Date()
): Promise<AppealRoutingContext> {
  const leads = await loadDepartmentLeads(client)
  const leadIdsByDepartment: Record<string, string[]> = {}
  for (const [department, ids] of leads.idsByDepartment) leadIdsByDepartment[department] = ids
  const allLeadIds = Array.from(new Set(Object.values(leadIdsByDepartment).flat()))
  const today = toLocalISODate(now)

  let onLeaveIds: string[] = []
  if (allLeadIds.length > 0) {
    const { data } = await client
      .from("leave_requests")
      .select("user_id")
      .in("user_id", allLeadIds)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .returns<Array<{ user_id: string }>>()
    onLeaveIds = Array.from(new Set((data ?? []).map((row) => row.user_id)))
  }

  const leadsWithDelegate = new Set<string>()
  const actingFor = new Set<string>()
  if (leads.adminHrLeadIds.length > 0) {
    const { data } = await client
      .from("admin_edit_grants")
      .select("user_id, delegated_from, valid_until")
      .in("delegated_from", leads.adminHrLeadIds)
      .in("route_key", ["hr.attendance", "hr.main"])
      .is("revoked_at", null)
      .returns<Array<{ user_id: string; delegated_from: string | null; valid_until: string | null }>>()
    for (const row of data ?? []) {
      if (row.valid_until && new Date(row.valid_until).getTime() <= now.getTime()) continue
      if (!row.delegated_from) continue
      leadsWithDelegate.add(row.delegated_from)
      if (reviewerId && row.user_id === reviewerId) actingFor.add(row.delegated_from)
    }
  }

  return {
    adminHrLeadIds: leads.adminHrLeadIds,
    leadIdsByDepartment,
    onLeaveIds,
    leadsWithDelegate: Array.from(leadsWithDelegate),
    actingForLeadIds: Array.from(actingFor),
  }
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
    /** Pass when already known (bulk), to skip a lead lookup per day. */
    departmentHasLead?: boolean
    /** Ties the days of one bulk range together (needs the 20261030090000 migration). */
    batchId?: string | null
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
  const hasLead = params.departmentHasLead ?? (await departmentHasLead(client, target?.department ?? null))
  const route = stagingRoute(params.actor, target, hasLead)
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
      ...(params.batchId ? { batch_id: params.batchId } : {}),
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
