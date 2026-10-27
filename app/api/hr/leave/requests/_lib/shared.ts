/** Schemas, row types and guards shared by the leave-request handlers (split from route.ts, audit 5.10). */
import { addIsoDays, countLeaveDays, trimRangeToWorkingDays, NO_HOLIDAYS, type HolidaySet } from "@/lib/hr/leave-days"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getHolidaySet } from "@/lib/hr/leave-workflow"
import { stageCodeForRole } from "@/lib/hr/leave-routing"

export const log = logger("leave-requests")
export const BLACKOUT_MONTHS = new Set([12, 1])

export const LeaveSegmentSchema = z.object({
  start_date: z.string().trim().min(1, "Segment start date is required"),
  end_date: z.string().trim().min(1, "Segment end date is required"),
})

export const CreateLeaveRequestSchema = z
  .object({
    leave_type_id: z.string().trim().min(1, "Missing required fields"),
    segments: z.array(LeaveSegmentSchema).min(1, "At least one date range is required"),
    emergency_override: z.boolean().optional(),
    reason: z.string().trim().min(1, "Missing required fields"),
    reliever_identifier: z.string().trim().min(1, "Missing required fields"),
    handover_note: z.string().trim().optional().nullable(),
    handover_checklist_url: z.string().trim().optional().nullable(),
  })
  .refine((data) => Boolean(data.handover_checklist_url), {
    message: "Handover document is required",
    path: ["handover_checklist_url"],
  })

export const UpdateLeaveRequestSchema = z.object({
  id: z.string().trim().min(1, "Leave request ID is required"),
  leave_type_id: z.string().optional(),
  segments: z.array(LeaveSegmentSchema).min(1).optional(),
  emergency_override: z.boolean().optional(),
  reason: z.string().optional(),
  reliever_identifier: z.string().optional(),
  handover_note: z.string().optional().nullable(),
  handover_checklist_url: z.string().optional().nullable(),
})

/**
 * Sorts segments, rejects inverted or overlapping ranges, trims each range down
 * to the working days it actually covers, and totals the days to deduct.
 *
 * Trimming is what stops a Mon-Sun selection from being stored as ending on a
 * Sunday: the stored range becomes Mon-Fri, so the resumption date the employee
 * is shown is the following Monday without them having to pad the selection.
 */
export function resolveSegments(
  segments: { start_date: string; end_date: string }[],
  holidays: HolidaySet = NO_HOLIDAYS
) {
  const sorted = [...segments].sort((a, b) => a.start_date.localeCompare(b.start_date))
  for (const segment of sorted) {
    if (segment.end_date < segment.start_date) {
      throw new Error("Each date range's end date must be on or after its start date")
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_date <= sorted[i - 1].end_date) {
      throw new Error("Date ranges cannot overlap each other")
    }
  }

  const trimmed = sorted
    .map((segment) => trimRangeToWorkingDays(segment.start_date, segment.end_date, holidays))
    .filter((segment): segment is { start_date: string; end_date: string } => segment !== null)

  if (trimmed.length === 0) {
    throw new Error(
      "Select at least one working day — weekends and public holidays are not deducted from your leave balance"
    )
  }

  const resolvedSegments = trimmed.map((segment, index) => ({
    start_date: segment.start_date,
    end_date: segment.end_date,
    days_count: countLeaveDays(segment.start_date, segment.end_date, holidays),
    segment_order: index + 1,
  }))

  const totalDays = resolvedSegments.reduce((sum, segment) => sum + segment.days_count, 0)

  return {
    segments: resolvedSegments,
    startDate: resolvedSegments[0].start_date,
    endDate: resolvedSegments[resolvedSegments.length - 1].end_date,
    totalDays,
  }
}

/**
 * Loads the holiday calendar covering the requested ranges, then resolves them.
 * The lookahead past the last date covers the resumption-date walk.
 */
export async function resolveSegmentsWithHolidays(
  client: SupabaseServerClient,
  segments: { start_date: string; end_date: string }[],
  location?: string | null
) {
  const dates = segments
    .flatMap((segment) => [segment.start_date, segment.end_date])
    .filter(Boolean)
    .sort()
  const spanStart = dates[0]
  const spanEnd = dates[dates.length - 1]
  if (!spanStart || !spanEnd) throw new Error("At least one date range is required")

  const lookaheadEnd = addIsoDays(spanEnd, 30)

  const holidays = await getHolidaySet(client, location, spanStart, lookaheadEnd)
  return { resolved: resolveSegments(segments, holidays), holidays }
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type LeaveRequestStageState = {
  id: string
  status: string
  current_stage_code?: string | null
  approval_stage?: string | null
}

export type ProfileReferenceRow = {
  id: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  company_email?: string | null
  department_id?: string | null
  department?: string | null
}

export type DepartmentReferenceRow = {
  id: string
  department_id?: string | null
}

export type LeaveTypeReferenceRow = {
  id: string
  name?: string | null
  code?: string | null
  max_days?: number | null
  requires_approval?: boolean | null
}

export type LeaveEvidenceRow = {
  id: string
  leave_request_id: string
  document_type?: string | null
  file_url?: string | null
  status?: string | null
  verified_by?: string | null
  verified_at?: string | null
  notes?: string | null
  created_at?: string | null
}

export type LeaveApprovalRow = {
  id: string
  leave_request_id: string
  approver_id?: string | null
  approval_level?: number | null
  status?: string | null
  comments?: string | null
  approved_at?: string | null
  stage_code?: string | null
  stage_order?: number | null
  superseded?: boolean | null
  reliever_revision?: number | null
}

export type LeaveBalanceRow = {
  leave_type_id?: string | null
  balance_days?: number | null
}

export type LeaveRequestRow = LeaveRequestStageState & {
  user_id: string
  leave_type_id: string
  reliever_id?: string | null
  supervisor_id?: string | null
  approved_by?: string | null
  current_approver_user_id?: string | null
  reliever_decision_at?: string | null
  supervisor_decision_at?: string | null
  hr_decision_at?: string | null
  route_snapshot?: Array<{
    stage_order?: number | null
    approver_role_code?: string | null
    approver_user_id?: string | null
  }> | null
  start_date?: string | null
  end_date?: string | null
  days_count?: number | null
  reason?: string | null
  handover_note?: string | null
}

export type LeavePolicySummary = {
  required_documents?: string[] | null
}

export type RelieverOption = {
  value: string
  label: string
}

export type RelieverDebug = {
  reason?: string
  user_id: string
  requester_profile_id: string | null
  requester_department: string | null
  requester_department_id: string | null
  resolution_source: string
  total_profiles_scanned: number
  matched_profiles: number
  options_count: number
}

export function normalizeDepartment(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
}

export function buildProfileLabel(row: ProfileReferenceRow) {
  return row.full_name?.trim() || `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unnamed"
}

export function isRelieverStage(request: LeaveRequestStageState) {
  const stage = request.current_stage_code || request.approval_stage
  return stage === "pending_reliever" || stage === "reliever_pending"
}

export type DepartmentOverlap = {
  id: string
  user_id: string
  full_name: string
  start_date: string
  end_date: string
  status: string
}

export async function findDepartmentOverlaps(
  supabase: SupabaseServerClient,
  requesterId: string,
  departmentId: string | null | undefined,
  startDate: string,
  endDate: string,
  excludeRequestId?: string
): Promise<DepartmentOverlap[]> {
  if (!departmentId) return []

  const { data: peers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("department_id", departmentId)
    .neq("id", requesterId)

  const peerList = (peers || []) as Array<{ id: string; full_name?: string | null }>
  if (peerList.length === 0) return []

  const peerMap = new Map<string, string>()
  for (const peer of peerList) {
    if (peer.id) peerMap.set(peer.id, peer.full_name || "Colleague")
  }
  const peerIds = Array.from(peerMap.keys())

  let overlapQuery = supabase
    .from("leave_requests")
    .select("id, user_id, start_date, end_date, status")
    .in("user_id", peerIds)
    .in("status", ["pending", "pending_evidence", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date", { ascending: true })

  if (excludeRequestId) {
    overlapQuery = overlapQuery.neq("id", excludeRequestId)
  }

  const { data: overlapRows, error: overlapError } = await overlapQuery
  if (overlapError || !overlapRows) {
    return []
  }

  return overlapRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    full_name: peerMap.get(row.user_id) || "Colleague",
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
  }))
}

/**
 * @deprecated Department leave overlap is no longer enforced as a hard rejection.
 * Use findDepartmentOverlaps to display a soft warning instead.
 */
export async function assertNoDepartmentOverlap(
  _supabase: SupabaseServerClient,
  _requesterId: string,
  _departmentId: string | null | undefined,
  _startDate: string,
  _endDate: string,
  _excludeRequestId?: string
): Promise<void> {
  // Soft warning only: no longer throws to allow multiple department members to request leave
}

export async function assertRequesterNotBlockedByRelieverCommitment(
  supabase: SupabaseServerClient,
  requesterId: string,
  startDate: string,
  endDate: string,
  excludeRequestId?: string
) {
  let overlapQuery = supabase
    .from("leave_requests")
    .select("id, user_id, reliever_id, start_date, end_date, status")
    .eq("reliever_id", requesterId)
    .neq("user_id", requesterId)
    .in("status", ["pending", "pending_evidence", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1)

  if (excludeRequestId) {
    overlapQuery = overlapQuery.neq("id", excludeRequestId)
  }

  const { data: overlapRows, error: overlapError } = await overlapQuery
  if (overlapError) {
    throw new Error("Failed to validate reliever commitment overlap")
  }

  if (overlapRows && overlapRows.length > 0) {
    throw new Error(
      "You are assigned as reliever for another leave during this period. You cannot request leave until that relief period ends."
    )
  }
}

export async function canRequesterModifyBeforeRelieverDecision(
  supabase: SupabaseServerClient,
  request: LeaveRequestStageState
) {
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

export async function getUserDepartmentId(supabase: SupabaseServerClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, department_id")
    .eq("id", userId)
    .maybeSingle<DepartmentReferenceRow>()

  return data?.department_id || null
}

export function assertSameDepartmentReliever(params: {
  requesterDepartmentId?: string | null
  relieverDepartmentId?: string | null
}) {
  if (!params.requesterDepartmentId || !params.relieverDepartmentId) {
    throw new Error("Requester and reliever must both have a department before leave can be submitted.")
  }

  if (params.requesterDepartmentId !== params.relieverDepartmentId) {
    throw new Error("Reliever must be from your department.")
  }
}

export function assertBlackoutWindowAllowed(params: {
  startDate: string
  endDate: string
  emergencyOverride?: boolean
}) {
  if (params.emergencyOverride) return

  const start = new Date(`${params.startDate}T00:00:00`)
  const end = new Date(`${params.endDate}T00:00:00`)
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const month = cursor.getMonth() + 1
    if (BLACKOUT_MONTHS.has(month)) {
      throw new Error(
        "Leave dates in December and January are restricted. Enable emergency override in the leave form if this is urgent."
      )
    }
  }
}
