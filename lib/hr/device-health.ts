import type { SupabaseClient } from "@supabase/supabase-js"
import { isWorkingDay } from "@/lib/hr/leave-days"
import { getHolidaySet } from "@/lib/hr/leave-workflow"
import { toLocalISODate } from "@/lib/utils/date"

/**
 * Is the Hikvision clock-in device delivering punches right now?
 *
 * One answer shared by the ICT alert email, the banner staff see on
 * /hr/attendance and the appeal guard, so they never disagree. When the device
 * goes quiet it keeps the punches and sends the backlog on reconnect, so the
 * honest message to staff is "wait", not "appeal".
 *
 * Punches cluster at arrival and departure, so silence only means something at
 * those two moments:
 *   morning - from 09:00 WAT, no clock-in received for today at all;
 *   evening - from 17:30 WAT, a normal number of clock-ins, fewer than half
 *             clocked out, and nothing received for 45 minutes. The silence
 *             test keeps a slow but working evening from tripping it.
 * Working days only.
 */
const MORNING_FROM_MINUTES = 9 * 60
const EVENING_FROM_MINUTES = 17 * 60 + 30
/** Below this many clock-ins the evening ratio means nothing (a quiet day, a holiday nobody entered). */
const EVENING_MIN_CLOCK_INS = 5
const EVENING_MIN_OUT_RATIO = 1 / 2
const EVENING_SILENCE_MS = 45 * 60_000

export type DeviceOfflineKind = "morning" | "evening"

export interface DeviceHealth {
  /** Today in WAT, yyyy-mm-dd. */
  date: string
  /** Why the device is considered offline, or null when it is fine (or it is not a working day). */
  offline: DeviceOfflineKind | null
  clockIns: number
  clockOuts: number
  /** When the most recent punch of any kind arrived (ISO), within the last week. */
  lastPunchAt: string | null
}

function watMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return get("hour") * 60 + get("minute")
}

async function countPunches(supabase: SupabaseClient, date: string, eventType: string): Promise<number> {
  const { count, error } = await supabase
    .from("attendance_events")
    .select("id", { head: true, count: "exact" })
    .eq("source", "hikvision")
    .eq("event_type", eventType)
    .eq("event_date", date)
  if (error) throw error
  return count ?? 0
}

/** Reads attendance_events across all staff, so pass a service-role client. */
export async function getDeviceHealth(supabase: SupabaseClient, now: Date = new Date()): Promise<DeviceHealth> {
  const date = toLocalISODate(now)

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const [clockIns, clockOuts, lastPunch, holidays] = await Promise.all([
    countPunches(supabase, date, "device_punch_in"),
    countPunches(supabase, date, "device_punch_out"),
    supabase
      .from("attendance_events")
      .select("created_at")
      .eq("source", "hikvision")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
    getHolidaySet(supabase, null, date, date),
  ])
  if (lastPunch.error) throw lastPunch.error
  const lastPunchAt = lastPunch.data?.created_at ?? null

  const health: DeviceHealth = { date, offline: null, clockIns, clockOuts, lastPunchAt }
  if (!isWorkingDay(date, holidays)) return health

  const minutes = watMinutes(now)
  if (minutes >= MORNING_FROM_MINUTES && clockIns === 0) {
    health.offline = "morning"
  } else if (
    minutes >= EVENING_FROM_MINUTES &&
    clockIns >= EVENING_MIN_CLOCK_INS &&
    clockOuts < clockIns * EVENING_MIN_OUT_RATIO &&
    (!lastPunchAt || now.getTime() - new Date(lastPunchAt).getTime() >= EVENING_SILENCE_MS)
  ) {
    health.offline = "evening"
  }
  return health
}

/**
 * The first day an appeal could be caused by the outage: the day of the last
 * punch received (punches after it are held on the device), or today when the
 * device has sent nothing all week.
 */
export function deviceOutageStartDate(health: DeviceHealth): string {
  return health.lastPunchAt ? toLocalISODate(new Date(health.lastPunchAt)) : health.date
}
