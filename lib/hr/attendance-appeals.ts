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
