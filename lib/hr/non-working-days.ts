import type { SupabaseClient } from "@supabase/supabase-js"
import { eachIsoDate, type HolidaySet } from "@/lib/hr/leave-days"
import { logger } from "@/lib/logger"

const log = logger("hr-non-working-days")

/**
 * Loaders for the days that should not count against someone's working-day clock: public holidays
 * and their own approved leave. Used by daily jobs that give people N working days to act (task
 * overdue grace, asset acceptance). Combine them with `nonWorkingDaysFor` from lib/tasks/overdue.
 *
 * Both fail soft: a lookup error falls back to weekends only and is logged, because one failed
 * lookup must not stop a whole run.
 */

export async function loadHolidays(supabase: SupabaseClient, start: string, end: string): Promise<HolidaySet> {
  const { data, error } = await supabase
    .from("holiday_calendar")
    .select("holiday_date")
    .gte("holiday_date", start)
    .lte("holiday_date", end)

  if (error) {
    // Weekends alone still give most of the intended grace, and a lookup
    // failure must not be allowed to fail the whole run.
    log.error({ err: String(error) }, "Holiday lookup failed; falling back to weekends only")
    return new Set<string>()
  }
  return new Set((data as Array<{ holiday_date: string }> | null)?.map((row) => row.holiday_date) ?? [])
}

/**
 * Approved leave for each person, expanded to the individual dates it
 * covers. Only approved leave counts: a request still sitting in the queue is
 * not yet time off, and treating it as such would let anyone pause a deadline
 * by filing one.
 */
export async function loadApprovedLeaveDates(
  supabase: SupabaseClient,
  userIds: string[],
  start: string,
  end: string
): Promise<Map<string, Set<string>>> {
  const byUser = new Map<string, Set<string>>()
  if (userIds.length === 0) return byUser

  const { data, error } = await supabase
    .from("leave_requests")
    .select("user_id, start_date, end_date")
    .in("user_id", userIds)
    .eq("status", "approved")
    .lte("start_date", end)
    .gte("end_date", start)

  if (error) {
    // Falling back to weekends and holidays alone can run someone's clock
    // while they were away, so this is loud rather than silent.
    log.error({ err: String(error) }, "Approved-leave lookup failed; working days will not account for leave")
    return byUser
  }

  for (const row of (data as Array<{ user_id: string; start_date: string; end_date: string }> | null) ?? []) {
    if (!row.user_id || !row.start_date || !row.end_date) continue
    const dates = byUser.get(row.user_id) ?? new Set<string>()
    for (const iso of eachIsoDate(row.start_date.slice(0, 10), row.end_date.slice(0, 10))) dates.add(iso)
    byUser.set(row.user_id, dates)
  }
  return byUser
}
