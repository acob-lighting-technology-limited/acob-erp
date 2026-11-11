/**
 * Which leave requests count as leave for attendance.
 *
 * Approved leave obviously does. Leave that has cleared every approver before the MD
 * and is only waiting on the MD also does: the MD signs these off after the staff
 * member has gone, so leaving the days as Absent in the meantime penalises someone the
 * company already agreed to release. Such days are recorded as leave and labelled
 * "pending MD"; if the MD ever rejects, the request leaves this set and the days
 * derive as they would have without it.
 *
 * Every attendance-facing read of `leave_requests` must use this one filter so the
 * screens, reports, payroll and the daily email cannot disagree.
 */

/** Stage code a request sits at while only the MD's decision is outstanding. */
export const MD_PENDING_STAGE = "pending_md"

/** PostgREST `.or()` expression: approved, or pending with only the MD left. */
export const LEAVE_COVERS_ATTENDANCE_OR = `status.eq.approved,and(status.eq.pending,current_stage_code.eq.${MD_PENDING_STAGE})`

export function isLeavePendingMd(row: { status?: string | null; current_stage_code?: string | null }): boolean {
  return row.status === "pending" && row.current_stage_code === MD_PENDING_STAGE
}
