import { z } from "zod"

// Select diagnostic fields rather than full request headers or structured SQL fields.
// Only columns documented for the unified `logs` table are used; severity lives
// in log_attributes, not a top-level column. API gateway traffic (edge_logs) is
// excluded because the app's own fetch monitor already records those failures,
// so importing them would count every Supabase error twice. What remains is what
// the app cannot see: database errors from triggers, cron and RPCs, and 5xx from
// Edge Functions, Auth, Storage and Realtime. Unique violations (23505) are
// excluded as they are usually handled duplicate inserts.
export const PLATFORM_ERROR_QUERY = `select timestamp, id, source, event_message,
  log_attributes['request.path'] as path,
  log_attributes['response.status_code'] as status
from logs
where source != 'edge_logs'
  and ((upper(log_attributes['parsed.error_severity']) in ('ERROR', 'FATAL', 'PANIC')
      and log_attributes['parsed.sql_state_code'] != '23505')
    or toInt32OrZero(log_attributes['response.status_code']) >= 500)
order by timestamp asc, id asc limit 500`

export function platformQuery(page?: { timestamp: string; id: string }) {
  if (!page) return PLATFORM_ERROR_QUERY
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z?$/.test(page.timestamp)) {
    throw new Error("Invalid platform timestamp")
  }
  // Preserve microseconds; rounding a page boundary can cause endless duplicates.
  const timestamp = page.timestamp.replace(/Z$/, "")
  const id = page.id.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
  return PLATFORM_ERROR_QUERY.replace(
    "\norder by",
    `\nand (timestamp > parseDateTime64BestEffort('${timestamp}', 6, 'UTC') or (timestamp = parseDateTime64BestEffort('${timestamp}', 6, 'UTC') and toString(id) > '${id}'))\norder by`
  )
}

export const PlatformLogSchema = z.object({
  id: z.string().min(1).max(200),
  timestamp: z.string(),
  source: z.string().max(100),
  event_message: z.string(),
  path: z.string().optional().default(""),
  status: z.string().optional().default(""),
})

export function logWindow(cursor: string | undefined, now = new Date()) {
  const end = new Date(now.getTime() - 60000) // allow ingestion time
  const parsed = cursor ? Date.parse(cursor) : NaN
  const earliest = end.getTime() - 23 * 60 * 60 * 1000
  const start = new Date(
    Math.min(
      end.getTime(),
      Math.max(earliest, Number.isFinite(parsed) ? parsed - 5 * 60000 : end.getTime() - 30 * 60000)
    )
  )
  return { start: start.toISOString(), end: end.toISOString() }
}
