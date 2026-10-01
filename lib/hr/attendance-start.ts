import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const log = logger("attendance-start")

/** Keeps each `in (...)` filter well inside URL length limits. */
const CHUNK_SIZE = 200

/**
 * Each person's first clock-in or manual edit - the input to
 * getEffectiveAttendanceStartDate, shared by reports, payroll, PMS scoring and
 * the per-employee day views so they cannot disagree.
 *
 * Reads the `attendance_start_dates` view (one row per person). These callers
 * used to load every attendance record to find the earliest, which the API's
 * 1,000-row cap silently truncated: anyone whose first record came later had
 * no start date and no absences counted.
 */
export async function loadAttendanceStartDates(
  client: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)
    const { data, error } = await client
      .from("attendance_start_dates")
      .select("user_id, first_attendance_date")
      .in("user_id", chunk)
      .returns<Array<{ user_id: string; first_attendance_date: string | null }>>()
    if (error) {
      log.error({ err: error.message }, "Failed to load attendance start dates")
      continue
    }
    for (const row of data ?? []) {
      if (row.first_attendance_date) result.set(row.user_id, row.first_attendance_date)
    }
  }
  return result
}

/** Single-person form of loadAttendanceStartDates. */
export async function loadAttendanceStartDate(client: SupabaseClient, userId: string): Promise<string | null> {
  return (await loadAttendanceStartDates(client, [userId])).get(userId) ?? null
}
