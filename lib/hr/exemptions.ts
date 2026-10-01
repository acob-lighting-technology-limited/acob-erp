import type { SupabaseClient } from "@supabase/supabase-js"
import { toLocalISODate } from "@/lib/utils/date"
import { recordAttendanceEvent } from "@/lib/hr/attendance-events"

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
