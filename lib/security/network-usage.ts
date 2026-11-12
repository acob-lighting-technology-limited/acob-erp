import { z } from "zod"

/**
 * Per-login data usage reported by the MikroTik hotspot every 5 minutes.
 *
 * The router sends running totals for each active session, not usage per
 * interval. `planUsageUpdate` turns two consecutive reports into the bytes used
 * between them, so a retried push adds nothing and a session that ends and
 * restarts is not subtracted from.
 *
 * Direction is the router's: `bytes_in` is what the person uploaded and
 * `bytes_out` is what they downloaded.
 */

export const NetworkUsageSessionSchema = z.object({
  user: z.string().trim().min(1).max(200),
  mac_address: z.string().trim().max(64).optional().nullable(),
  address: z.string().trim().max(64).optional().nullable(),
  uptime: z.string().max(32).optional().nullable(),
  bytes_in: z.number().int().nonnegative(),
  bytes_out: z.number().int().nonnegative(),
})

export const NetworkUsageBatchSchema = z.object({
  router: z.string().trim().min(1).max(64),
  sent_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "sent_at must be an ISO timestamp"),
  router_uptime: z.string().max(32).optional().nullable(),
  wan: z
    .object({
      interface: z.string().trim().min(1).max(64),
      rx_bytes: z.number().int().nonnegative(),
      tx_bytes: z.number().int().nonnegative(),
    })
    .optional()
    .nullable(),
  sessions: z.array(NetworkUsageSessionSchema).max(1000),
})

export type NetworkUsageBatch = z.infer<typeof NetworkUsageBatchSchema>
export type NetworkUsageSession = z.infer<typeof NetworkUsageSessionSchema>

/** What the previous report left behind for one counter. */
export interface UsageState {
  bytesIn: number
  bytesOut: number
  uptimeSeconds: number | null
  seenAtMs: number
}

/** A session first seen this long after it started is baselined, not counted back to its login. */
const NEW_SESSION_MAX_UPTIME_SECONDS = 600
/** Clock and scheduling jitter allowed when comparing session uptime with the gap between reports. */
const UPTIME_SLACK_SECONDS = 120

const UPTIME_PARTS: Record<string, number> = { w: 604_800, d: 86_400, h: 3_600, m: 60, s: 1 }

/**
 * RouterOS prints uptimes as `1d02:03:04`, `01:43:45` or `1w2d3h4m5s`
 * depending on version and length. Null when the text is not one of those.
 */
export function parseRouterUptime(value: string | null | undefined): number | null {
  const text = (value ?? "").trim()
  if (!text) return null

  const clock = /^(?:(\d+)d)?(\d{1,2}):(\d{2}):(\d{2})$/.exec(text)
  if (clock) {
    const [, days, hours, minutes, seconds] = clock
    return Number(days ?? 0) * 86_400 + Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds)
  }

  const units = /^(?:\d+[wdhms])+$/.test(text) ? [...text.matchAll(/(\d+)([wdhms])/g)] : []
  if (units.length === 0) return null
  return units.reduce((sum, [, amount, unit]) => sum + Number(amount) * UPTIME_PARTS[unit], 0)
}

export interface UsageDelta {
  bytesIn: number
  bytesOut: number
  /** True when the counter started over (new session, or the router restarted). */
  restarted: boolean
}

/**
 * Bytes used since the previous report for one session.
 *
 * A session only ever counts up, so a lower counter or a shorter uptime means
 * it restarted and the whole current value is new. A session shorter than the
 * gap since the last report also began after it. Anything unclear is counted as
 * zero rather than guessed, so a mistake can only under-count, never inflate.
 */
export function sessionDelta(
  previous: UsageState | undefined,
  current: { bytesIn: number; bytesOut: number; uptimeSeconds: number | null },
  nowMs: number
): UsageDelta {
  if (!previous) {
    const startedRecently = current.uptimeSeconds !== null && current.uptimeSeconds <= NEW_SESSION_MAX_UPTIME_SECONDS
    return startedRecently
      ? { bytesIn: current.bytesIn, bytesOut: current.bytesOut, restarted: true }
      : { bytesIn: 0, bytesOut: 0, restarted: false }
  }

  const gapSeconds = Math.max(0, (nowMs - previous.seenAtMs) / 1000)
  const uptime = current.uptimeSeconds
  const restarted =
    current.bytesIn < previous.bytesIn ||
    current.bytesOut < previous.bytesOut ||
    (uptime !== null && previous.uptimeSeconds !== null && uptime < previous.uptimeSeconds) ||
    (uptime !== null && uptime + UPTIME_SLACK_SECONDS < gapSeconds)

  return restarted
    ? { bytesIn: current.bytesIn, bytesOut: current.bytesOut, restarted: true }
    : { bytesIn: current.bytesIn - previous.bytesIn, bytesOut: current.bytesOut - previous.bytesOut, restarted: false }
}

/** Interface counters reset only when the router restarts; the first report is a baseline. */
export function counterDelta(previous: UsageState | undefined, current: { bytesIn: number; bytesOut: number }) {
  if (!previous) return { bytesIn: 0, bytesOut: 0 }
  const restarted = current.bytesIn < previous.bytesIn || current.bytesOut < previous.bytesOut
  return restarted
    ? { bytesIn: current.bytesIn, bytesOut: current.bytesOut }
    : { bytesIn: current.bytesIn - previous.bytesIn, bytesOut: current.bytesOut - previous.bytesOut }
}

export interface DailyUsageRow {
  router: string
  username: string
  mac_address: string
  address: string | null
  bytes_in: number
  bytes_out: number
}

export interface UsageStateRow {
  key: string
  bytes_in: number
  bytes_out: number
  uptime_seconds: number | null
}

export interface UsageUpdatePlan {
  daily: DailyUsageRow[]
  state: UsageStateRow[]
  wan: { interface: string; rx_bytes: number; tx_bytes: number } | null
  wanState: UsageStateRow | null
}

export const sessionStateKey = (router: string, session: NetworkUsageSession): string =>
  [router, "s", session.user.toLowerCase(), (session.mac_address ?? "").toUpperCase(), session.address ?? ""].join("|")

export const wanStateKey = (router: string, iface: string): string => [router, "wan", iface].join("|")

/** The state keys a batch needs read back before it can be planned. */
export function stateKeysFor(batch: NetworkUsageBatch): string[] {
  const keys = batch.sessions.map((session) => sessionStateKey(batch.router, session))
  if (batch.wan) keys.push(wanStateKey(batch.router, batch.wan.interface))
  return [...new Set(keys)]
}

/**
 * Turns one report plus what was stored last time into the rows to add and the new state to keep.
 * `nowMs` is when the server received the report: the router's own clock is only informational,
 * so a wrong router time cannot put usage on the wrong day or break the gap check.
 */
export function planUsageUpdate(
  batch: NetworkUsageBatch,
  states: Map<string, UsageState>,
  nowMs: number
): UsageUpdatePlan {
  const daily = new Map<string, DailyUsageRow>()
  const state = new Map<string, UsageStateRow>()

  for (const session of batch.sessions) {
    const key = sessionStateKey(batch.router, session)
    const uptimeSeconds = parseRouterUptime(session.uptime)
    const delta = sessionDelta(
      states.get(key),
      { bytesIn: session.bytes_in, bytesOut: session.bytes_out, uptimeSeconds },
      nowMs
    )

    state.set(key, { key, bytes_in: session.bytes_in, bytes_out: session.bytes_out, uptime_seconds: uptimeSeconds })

    // Several devices can share a login; one row per login and device.
    const username = session.user.toLowerCase()
    const mac = (session.mac_address ?? "").toUpperCase()
    const dailyKey = `${username}|${mac}`
    const row = daily.get(dailyKey) ?? {
      router: batch.router,
      username,
      mac_address: mac,
      address: session.address ?? null,
      bytes_in: 0,
      bytes_out: 0,
    }
    row.bytes_in += delta.bytesIn
    row.bytes_out += delta.bytesOut
    daily.set(dailyKey, row)
  }

  let wan: UsageUpdatePlan["wan"] = null
  let wanState: UsageStateRow | null = null
  if (batch.wan) {
    const key = wanStateKey(batch.router, batch.wan.interface)
    const delta = counterDelta(states.get(key), { bytesIn: batch.wan.rx_bytes, bytesOut: batch.wan.tx_bytes })
    wan = { interface: batch.wan.interface, rx_bytes: delta.bytesIn, tx_bytes: delta.bytesOut }
    wanState = { key, bytes_in: batch.wan.rx_bytes, bytes_out: batch.wan.tx_bytes, uptime_seconds: null }
  }

  return { daily: [...daily.values()], state: [...state.values()], wan, wanState }
}
