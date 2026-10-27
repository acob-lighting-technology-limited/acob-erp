import type { SupabaseClient } from "@supabase/supabase-js"
import { toLocalISODate } from "@/lib/utils/date"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"
import { stageAttendanceChange, type StageChangeResult, type StagingActor } from "@/lib/hr/attendance-appeals"

/**
 * "Stop" an exemption without erasing history.
 *
 * Exemption is DERIVED at render time from `profiles.attendance_exempt` (an open,
 * going-forward flag) plus dated rows in `attendance_exempt_periods`. Because it is
 * derived, simply clearing the flag would retroactively un-exempt every past day the
 * person was exempt. That is the opposite of what "stop" should mean.
 *
 * This freezes the exemption AT TODAY:
 *  - an open infinite exemption (the flag) is converted into a closed
 *    [start .. today] period so past days stay exempt when re-derived,
 *  - future-dated periods are dropped,
 *  - periods straddling today are truncated to end today,
 *  - fully-past periods are left untouched.
 *
 * The flag is cleared so no new days become exempt going forward.
 */
export async function freezeExemptionAtToday(
  dataClient: SupabaseClient,
  userId: string,
  actorId: string | null
): Promise<void> {
  const today = toLocalISODate()

  const { data: current } = await dataClient
    .from("profiles")
    .select("attendance_exempt, attendance_exempt_reason, attendance_exempt_set_at")
    .eq("id", userId)
    .maybeSingle()

  // Clear the going-forward flag first.
  const { error: offErr } = await dataClient
    .from("profiles")
    .update({ attendance_exempt: false, attendance_exempt_until: null })
    .eq("id", userId)
  if (offErr) {
    // Backward-compat: environments missing the audit column still clear the flag.
    await dataClient.from("profiles").update({ attendance_exempt: false }).eq("id", userId)
  }

  // Preserve the history of an open infinite exemption as a closed window.
  if (current?.attendance_exempt) {
    const startIso = current.attendance_exempt_set_at
      ? toLocalISODate(new Date(current.attendance_exempt_set_at))
      : today
    const frozenStart = startIso > today ? today : startIso
    await insertExemptPeriod(dataClient, {
      user_id: userId,
      start_date: frozenStart,
      end_date: today,
      kind: "infinite",
      reason: current.attendance_exempt_reason || null,
      created_by: actorId ?? undefined,
    })
  }

  // Drop future-dated windows (they never started).
  await dataClient.from("attendance_exempt_periods").delete().eq("user_id", userId).gt("start_date", today)

  // Truncate windows that straddle today so they end today.
  const { data: straddling } = await dataClient
    .from("attendance_exempt_periods")
    .select("id")
    .eq("user_id", userId)
    .lte("start_date", today)
    .gt("end_date", today)
  for (const p of (straddling ?? []) as Array<{ id: string }>) {
    await dataClient.from("attendance_exempt_periods").update({ end_date: today }).eq("id", p.id)
  }
}

/**
 * Insert an exemption period, tolerating environments where the `kind` CHECK has not
 * yet been widened to include the requested kind (falls back to the legacy 'monthly').
 */
export async function insertExemptPeriod(
  dataClient: SupabaseClient,
  row: {
    user_id: string
    start_date: string
    end_date: string
    kind: "weekly" | "monthly" | "period" | "infinite"
    reason?: string | null
    created_by?: string
  }
): Promise<{ error: { message?: string } | null }> {
  const { error } = await dataClient.from("attendance_exempt_periods").insert(row)
  if (!error) return { error: null }
  // Legacy CHECK only allowed weekly|monthly — persist as monthly so history is not lost.
  const legacyKind = row.kind === "weekly" ? "weekly" : "monthly"
  const { error: fallbackError } = await dataClient
    .from("attendance_exempt_periods")
    .insert({ ...row, kind: legacyKind })
  return { error: fallbackError ?? null }
}

type ExemptPeriod = { start_date: string; end_date: string; kind: string | null }

export interface ExemptionSnapshot {
  openEnded: boolean
  periods: ExemptPeriod[]
}

/** A person's exemption configuration, read before and after a change so the change can be logged. */
export async function snapshotExemption(dataClient: SupabaseClient, userId: string): Promise<ExemptionSnapshot> {
  const [{ data: profile }, { data: periods }] = await Promise.all([
    dataClient.from("profiles").select("attendance_exempt").eq("id", userId).maybeSingle(),
    dataClient
      .from("attendance_exempt_periods")
      .select("start_date, end_date, kind")
      .eq("user_id", userId)
      .order("start_date", { ascending: true }),
  ])
  return { openEnded: Boolean(profile?.attendance_exempt), periods: (periods ?? []) as ExemptPeriod[] }
}

function describeSnapshot(snapshot: ExemptionSnapshot): string {
  const parts = snapshot.periods.map((p) =>
    p.start_date === p.end_date ? p.start_date : `${p.start_date} to ${p.end_date}`
  )
  if (snapshot.openEnded) parts.push("open-ended")
  return parts.length > 0 ? parts.join(", ") : "none"
}

/**
 * Logs an exemption change on the attendance timeline, for the Change log.
 *
 * Saving an exemption replaces every existing period for the person (both the
 * single and bulk editors delete and re-insert), which can quietly change past
 * days. Neither recorded anything, so the change was invisible to an audit.
 * This records what the configuration was and what it became.
 */
export async function recordExemptionChange(
  dataClient: SupabaseClient,
  params: {
    userId: string
    actorId: string | null
    mode: string
    reason?: string | null
    before: ExemptionSnapshot
    after: ExemptionSnapshot
  }
): Promise<void> {
  const before = describeSnapshot(params.before)
  const after = describeSnapshot(params.after)
  if (before === after) return
  const stopped = params.mode === "off"
  await recordAttendanceEvent(dataClient, {
    userId: params.userId,
    eventDate: toLocalISODate(),
    eventType: stopped ? "exemption_removed" : "exemption_added",
    toStatus: stopped ? null : "exempted",
    source: "manual",
    // `comment` is only what the person typed; the system's description is kept apart.
    comment: params.reason?.trim() || null,
    actorId: params.actorId,
    metadata: {
      mode: params.mode,
      before: params.before,
      after: params.after,
      summary: `Exemption ${stopped ? "stopped" : `set (${params.mode})`}. Was: ${before}. Now: ${after}.`,
    },
  })
}

/**
 * A requested exemption setting. Every mode except "off" replaces the person's
 * windows; `append` (the single "add a period" action) adds one window and leaves
 * the rest alone. Staged on an appeal as JSON and applied once it is confirmed.
 */
export type ExemptionChange = {
  mode: "infinite" | "weekly" | "monthly" | "period"
  month?: string
  weeks?: number[]
  months?: string[]
  start_date?: string
  end_date?: string
  append?: boolean
  reason?: string | null
}

function monthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number)
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0)) }
}

function formatDateUTC(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

function weekRangeInMonth(yearMonth: string, weekIndex: number) {
  const { start, end } = monthRange(yearMonth)
  const rangeStart = new Date(start)
  rangeStart.setUTCDate(start.getUTCDate() + (weekIndex - 1) * 7)
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setUTCDate(rangeStart.getUTCDate() + 6)
  if (rangeStart > end) return null
  if (rangeEnd > end) rangeEnd.setTime(end.getTime())
  return { start: formatDateUTC(rangeStart), end: formatDateUTC(rangeEnd) }
}

/** The dated windows a change creates, or an error message when it is incomplete. */
export function exemptionWindows(
  change: ExemptionChange
): { windows: Array<{ start_date: string; end_date: string; kind: "weekly" | "monthly" }> } | { error: string } {
  if (change.mode === "infinite") return { windows: [] }
  if (change.mode === "weekly") {
    if (!change.month || !change.weeks?.length) return { error: "Select a month and at least one week" }
    const month = change.month
    return {
      windows: change.weeks
        .map((w) => weekRangeInMonth(month, w))
        .filter((r): r is { start: string; end: string } => r !== null)
        .map((r) => ({ start_date: r.start, end_date: r.end, kind: "weekly" as const })),
    }
  }
  if (change.mode === "monthly") {
    if (!change.months?.length) return { error: "Select at least one month" }
    return {
      windows: change.months.map((ym) => {
        const range = monthRange(ym)
        return { start_date: formatDateUTC(range.start), end_date: formatDateUTC(range.end), kind: "monthly" as const }
      }),
    }
  }
  if (!change.start_date || !change.end_date || change.start_date > change.end_date) {
    return { error: "Choose a valid start and end date" }
  }
  // DB only allows weekly/monthly kinds; a custom period persists as a monthly-kind range.
  return { windows: [{ start_date: change.start_date, end_date: change.end_date, kind: "monthly" }] }
}

/** First day the change covers — the date its approval appeal sits on. */
export function exemptionStartDate(change: ExemptionChange): string {
  const result = exemptionWindows(change)
  const first = "windows" in result ? result.windows.map((w) => w.start_date).sort()[0] : undefined
  return first ?? toLocalISODate()
}

export function describeExemptionChange(change: ExemptionChange): string {
  if (change.mode === "infinite") return "Exempt from clocking in, open-ended"
  const result = exemptionWindows(change)
  const ranges = "windows" in result ? result.windows.map((w) => `${w.start_date} to ${w.end_date}`).join(", ") : ""
  return `Exempt from clocking in (${change.mode}): ${ranges}`
}

/**
 * Applies a confirmed exemption change: sets the open-ended flag, replaces (or, with
 * `append`, adds to) the dated windows, and logs the before/after on the timeline.
 * Tolerates environments missing the newer profile/period columns.
 */
export async function applyExemptionChange(
  dataClient: SupabaseClient,
  userId: string,
  change: ExemptionChange,
  actorId: string
): Promise<{ error: string | null }> {
  const windows = exemptionWindows(change)
  if ("error" in windows) return { error: windows.error }
  const reason = change.reason || null
  const before = await snapshotExemption(dataClient, userId)

  if (!change.append) {
    const attendance_exempt = change.mode === "infinite"
    const { error: profileError } = await dataClient
      .from("profiles")
      .update({
        attendance_exempt,
        attendance_exempt_until: null,
        attendance_exempt_reason: reason,
        attendance_exempt_set_at: new Date().toISOString(),
        attendance_exempt_set_by: actorId,
      })
      .eq("id", userId)
    if (profileError) {
      const { error: minimalError } = await dataClient.from("profiles").update({ attendance_exempt }).eq("id", userId)
      if (minimalError) return { error: "Failed to update exemption" }
    }
    const { error: resetError } = await dataClient.from("attendance_exempt_periods").delete().eq("user_id", userId)
    if (resetError) return { error: "Failed to reset exemption periods" }
  }

  for (const w of windows.windows) {
    const { error } = await insertExemptPeriod(dataClient, {
      user_id: userId,
      start_date: w.start_date,
      end_date: w.end_date,
      kind: w.kind,
      reason,
      created_by: actorId,
    })
    if (error) return { error: "Failed to save exemption period" }
  }

  await recordExemptionChange(dataClient, {
    userId,
    actorId,
    mode: change.mode,
    reason,
    before,
    after: await snapshotExemption(dataClient, userId),
  })
  return { error: null }
}

/**
 * Two-stage rule: an exemption change is staged as one appeal on its first day and
 * applied by applyExemptionChange once the other side confirms it.
 */
export async function stageExemptionChange(
  dataClient: SupabaseClient,
  actor: StagingActor,
  userId: string,
  change: ExemptionChange
): Promise<StageChangeResult> {
  const windows = exemptionWindows(change)
  if ("error" in windows) return { ok: false, status: 400, error: windows.error }
  const date = exemptionStartDate(change)
  const summary = describeExemptionChange(change)
  const { data: record } = await dataClient
    .from("attendance_records")
    .select("id, status")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle<{ id: string; status: string | null }>()
  return stageAttendanceChange(dataClient, {
    actor,
    userId,
    date,
    attendanceRecordId: record?.id ?? null,
    currentStatus: record?.status || "absent",
    requestedStatus: "exempted",
    reason: change.reason?.trim() ? `${summary}: ${change.reason.trim()}` : summary,
    change: { kind: "exemption", payload: change, summary },
  })
}
