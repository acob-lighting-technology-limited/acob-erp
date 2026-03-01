import type { SupabaseClient } from "@supabase/supabase-js"
import { getOfficeWeekMonday } from "@/lib/meeting-week"

export type WeeklyReportLockState = {
  meetingDate: string
  graceHours: number
  unlockUntil: string | null
  lockDeadline: string
  isLocked: boolean
}

type LockStateRow = {
  meeting_date: string
  grace_hours: number
  unlock_until: string | null
  lock_deadline: string
  is_locked: boolean
}

export function getDefaultMeetingDateIso(week: number, year: number): string {
  const monday = getOfficeWeekMonday(week, year)
  const yyyy = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, "0")
  const dd = String(monday.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export async function fetchWeeklyReportLockState(
  supabase: SupabaseClient,
  week: number,
  year: number
): Promise<WeeklyReportLockState> {
  const fallbackMeetingDate = getDefaultMeetingDateIso(week, year)

  const { data, error } = await supabase.rpc("weekly_report_lock_state", {
    p_week: week,
    p_year: year,
  })

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    const fallbackDeadline = new Date(`${fallbackMeetingDate}T23:59:59+01:00`)
    fallbackDeadline.setHours(fallbackDeadline.getHours() + 24)
    return {
      meetingDate: fallbackMeetingDate,
      graceHours: 24,
      unlockUntil: null,
      lockDeadline: fallbackDeadline.toISOString(),
      isLocked: false,
    }
  }

  const row = data[0] as LockStateRow
  return {
    meetingDate: row.meeting_date,
    graceHours: row.grace_hours,
    unlockUntil: row.unlock_until,
    lockDeadline: row.lock_deadline,
    isLocked: row.is_locked,
  }
}
