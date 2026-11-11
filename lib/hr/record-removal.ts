import type { SupabaseClient } from "@supabase/supabase-js"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import { deriveUnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import type { AttendancePolicy } from "@/lib/org-config"

/**
 * Removing a manual attendance record (OOS, waiver, an override) is staged like applying one:
 * an appeal whose change_kind is "record_removal" carries the record, and applyRecordRemoval
 * runs only once the removal is confirmed. Before this, removal was an instant delete.
 */

export type RecordRemovalChange = { record_id: string }

export type RemovableRecord = {
  id: string
  user_id: string
  date: string
  status: string
  clock_in: string | null
  clock_out: string | null
}

/**
 * What removing `row` does. A record with real punches was an override, so it reverts to what
 * the punches say (the clock-ins are kept). A record with no punch was purely manual, so it is
 * deleted and the day derives from scratch. `status` is what the day will show afterwards.
 */
export function planRecordRemoval(
  row: Pick<RemovableRecord, "date" | "clock_in" | "clock_out">,
  policy: AttendancePolicy
): { action: "revert" | "delete"; status: string } {
  if (row.clock_in || row.clock_out) {
    return {
      action: "revert",
      status: deriveUnifiedAttendanceStatus(
        {
          record: { clock_in: row.clock_in, clock_out: row.clock_out, waived: false, status: null },
          recordDate: row.date,
        },
        policy
      ),
    }
  }
  return { action: "delete", status: deriveUnifiedAttendanceStatus({ record: null, recordDate: row.date }, policy) }
}

/**
 * Carries out a confirmed removal. A record that is already gone (removed some other way
 * since it was staged) is not an error: the outcome the approver confirmed is already true.
 */
export async function applyRecordRemoval(
  dataClient: SupabaseClient,
  userId: string,
  change: RecordRemovalChange,
  actorId: string
): Promise<{ error: string | null }> {
  const { data: row } = await dataClient
    .from("attendance_records")
    .select("id, user_id, date, status, clock_in, clock_out")
    .eq("id", change.record_id)
    .eq("user_id", userId)
    .maybeSingle<RemovableRecord>()
  if (!row) return { error: null }

  const plan = planRecordRemoval(row, await loadAttendancePolicy(dataClient))
  const reverted = plan.action === "revert"

  const { error } = reverted
    ? await dataClient
        .from("attendance_records")
        .update({ status: plan.status, waived: false, manual_comment: null, source: "hikvision" })
        .eq("id", row.id)
    : await dataClient.from("attendance_records").delete().eq("id", row.id)
  if (error) return { error: "Could not remove the attendance record" }

  await recordAttendanceEvent(dataClient, {
    userId: row.user_id,
    eventDate: row.date,
    eventType: reverted ? "manual_update" : "bulk_delete",
    attendanceRecordId: reverted ? row.id : null,
    fromStatus: row.status,
    toStatus: reverted ? plan.status : null,
    source: "manual",
    comment: reverted ? "Override removed — reverted to recorded attendance" : "Removal confirmed",
    actorId,
  })
  return { error: null }
}
