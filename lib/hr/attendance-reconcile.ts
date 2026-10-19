import type { SupabaseClient } from "@supabase/supabase-js"
import { applyLunchBreak } from "@/lib/hr/attendance-ssot"
import { loadAttendancePolicy } from "@/lib/hr/attendance-utils"
import { logger } from "@/lib/logger"

const log = logger("hr-attendance-reconcile")

/**
 * Puts clock times back to what the ERP itself recorded.
 *
 * Clock times may only come from the device, the app's clock-in/out, or an
 * admin edit through the ERP - every one of those writes the time it set into
 * audit_logs (new_values) and attendance_events (metadata). A time in
 * attendance_records that matches neither ledger was written some other way,
 * typically straight on the database, and is reverted here.
 *
 * Expected value per field = the most recent ledger entry that carries that
 * field. A clock-out with no ledger entry at all was never recorded by anything
 * and is cleared. Records with a time but no ledger entries whatsoever cannot
 * be checked (older than the ledger, or inserted outside the ERP); they are
 * reported, never changed. Statuses are not touched: the database trigger
 * re-derives them from the restored times, and permission statuses (LWP, IWP,
 * OOS, leave) are preserved by that trigger.
 */

const ID_CHUNK = 150
const PAGE = 1000

interface RecordRow {
  id: string
  user_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  created_at: string
}

interface LedgerEntry {
  at: string
  clockIn?: string | null
  clockOut?: string | null
}

export interface AttendanceCorrection {
  recordId: string
  userId: string
  date: string
  field: "clock_in" | "clock_out"
  was: string | null
  restored: string | null
}

export interface UnverifiedRecord {
  recordId: string
  userId: string
  date: string
  clockIn: string | null
  clockOut: string | null
}

export interface ReconcileResult {
  checked: number
  corrections: AttendanceCorrection[]
  unverified: UnverifiedRecord[]
  failed: number
}

/** "08:15" and "08:15:00.000" both become "08:15:00". */
function normTime(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 5) return null
  return value.length === 5 ? `${value}:00` : value.slice(0, 8)
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function loadRecords(supabase: SupabaseClient, since: string, until: string): Promise<RecordRow[]> {
  const rows: RecordRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, user_id, date, clock_in, clock_out, created_at")
      .gte("date", since)
      .lte("date", until)
      .or("clock_in.not.is.null,clock_out.not.is.null")
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as RecordRow[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

function fieldsOf(source: Record<string, unknown> | null | undefined): Omit<LedgerEntry, "at"> {
  const entry: Omit<LedgerEntry, "at"> = {}
  if (!source) return entry
  if ("clock_in" in source) entry.clockIn = normTime(source.clock_in)
  if ("clock_out" in source) entry.clockOut = normTime(source.clock_out)
  return entry
}

async function loadLedger(supabase: SupabaseClient, recordIds: string[]): Promise<Map<string, LedgerEntry[]>> {
  const ledger = new Map<string, LedgerEntry[]>()
  const add = (id: string, entry: LedgerEntry) => {
    if (entry.clockIn === undefined && entry.clockOut === undefined) return
    const list = ledger.get(id) ?? []
    list.push(entry)
    ledger.set(id, list)
  }

  for (const ids of chunk(recordIds, ID_CHUNK)) {
    const [audits, events] = await Promise.all([
      supabase
        .from("audit_logs")
        .select("entity_id, created_at, new_values")
        .eq("entity_type", "attendance_record")
        .in("entity_id", ids),
      supabase
        .from("attendance_events")
        .select("attendance_record_id, created_at, metadata")
        .in("attendance_record_id", ids),
    ])
    if (audits.error) throw audits.error
    if (events.error) throw events.error

    for (const row of (audits.data ?? []) as Array<{
      entity_id: string
      created_at: string
      new_values: Record<string, unknown> | null
    }>) {
      add(row.entity_id, { at: row.created_at, ...fieldsOf(row.new_values) })
    }
    for (const row of (events.data ?? []) as Array<{
      attendance_record_id: string
      created_at: string
      metadata: Record<string, unknown> | null
    }>) {
      add(row.attendance_record_id, { at: row.created_at, ...fieldsOf(row.metadata) })
    }
  }

  for (const list of ledger.values()) list.sort((a, b) => a.at.localeCompare(b.at))
  return ledger
}

function latest(entries: LedgerEntry[], field: "clockIn" | "clockOut"): string | null | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][field] !== undefined) return entries[i][field]
  }
  return undefined
}

export async function reconcileAttendanceWithLedger(
  supabase: SupabaseClient,
  options: { since: string; until: string; apply: boolean }
): Promise<ReconcileResult> {
  const records = await loadRecords(supabase, options.since, options.until)
  const ledger = await loadLedger(
    supabase,
    records.map((r) => r.id)
  )
  const policy = await loadAttendancePolicy(supabase)

  const result: ReconcileResult = { checked: records.length, corrections: [], unverified: [], failed: 0 }

  for (const record of records) {
    const entries = ledger.get(record.id)
    const currentIn = normTime(record.clock_in)
    const currentOut = normTime(record.clock_out)

    if (!entries || entries.length === 0) {
      result.unverified.push({
        recordId: record.id,
        userId: record.user_id,
        date: record.date,
        clockIn: currentIn,
        clockOut: currentOut,
      })
      continue
    }

    const ledgerIn = latest(entries, "clockIn")
    const ledgerOut = latest(entries, "clockOut")
    const expectedIn = ledgerIn === undefined ? currentIn : ledgerIn
    // Nothing in the ERP ever recorded a clock-out for this day, so any clock-out present was invented.
    const expectedOut = ledgerOut === undefined ? null : ledgerOut

    const fixes: AttendanceCorrection[] = []
    if (expectedIn !== currentIn) {
      fixes.push({ ...base(record), field: "clock_in", was: currentIn, restored: expectedIn })
    }
    if (expectedOut !== currentOut) {
      fixes.push({ ...base(record), field: "clock_out", was: currentOut, restored: expectedOut })
    }
    if (fixes.length === 0) continue

    if (options.apply) {
      const update: Record<string, unknown> = { clock_in: expectedIn, clock_out: expectedOut }
      if (expectedIn && expectedOut) {
        const rawHours = Math.max(
          0,
          (new Date(`${record.date}T${expectedOut}Z`).getTime() - new Date(`${record.date}T${expectedIn}Z`).getTime()) /
            3_600_000
        )
        const { breakMinutes, workedHours } = applyLunchBreak(rawHours, policy)
        update.total_hours = Math.round(workedHours * 100) / 100
        update.break_duration = breakMinutes
      } else {
        update.total_hours = null
        update.break_duration = null
      }
      if (!expectedOut) update.clock_out_source = null
      if (!expectedIn) update.clock_in_source = null
      // A created_at moved earlier than the first thing the ERP recorded was backdated to hide the edit.
      if (new Date(record.created_at).getTime() < new Date(entries[0].at).getTime() - 60_000) {
        update.created_at = entries[0].at
      }

      const { error } = await supabase.from("attendance_records").update(update).eq("id", record.id)
      if (error) {
        log.error({ err: error.message, recordId: record.id }, "Failed to restore attendance record")
        result.failed++
        continue
      }
    }
    result.corrections.push(...fixes)
  }

  return result
}

function base(record: RecordRow) {
  return { recordId: record.id, userId: record.user_id, date: record.date }
}
