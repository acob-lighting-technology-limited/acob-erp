/**
 * The attendance Change log: every change a person made to attendance, read
 * from the `attendance_events` timeline, for audit and export.
 *
 * Only changes a person made. Excluded: clock punches (not alterations),
 * employees raising appeals (the Appeals tab), and anything automatic - the
 * overnight job marking missing clock-outs incomplete, and appeals closed
 * because late device punches fixed the day. Those happened without anyone
 * deciding them, so an auditor reading "who changed this" should not see them.
 */

export type ChangeLogCategory = "edits" | "bulk" | "appeals" | "leave" | "exemptions" | "out_of_station"

export const CHANGE_LOG_CATEGORY_LABELS: Record<ChangeLogCategory, string> = {
  edits: "Record edits",
  bulk: "Bulk changes",
  appeals: "Appeal decisions",
  leave: "Leave",
  exemptions: "Exemptions",
  out_of_station: "Out of station",
}

/** Event types a person causes. */
export const MANUAL_CHANGE_EVENT_TYPES = [
  "manual_create",
  "manual_update",
  "manual_delete",
  "bulk_grant",
  "bulk_delete",
  "appeal_approved",
  "appeal_rejected",
  "appeal_auto_resolved",
  "leave_granted",
  "leave_revoked",
  "exemption_added",
  "exemption_removed",
  "oos_stopped",
  "holiday_added",
  "holiday_removed",
] as const

/** Sources that mean nobody decided the change: the device, the overnight job, other automation. */
export const AUTOMATIC_EVENT_SOURCES = ["hikvision", "cron", "system"] as const

export interface ChangeLogAppeal {
  id: string
  status: string
  requested_status: string
  appeal_reason: string | null
  resolution_note: string | null
}

/** One timeline event: one person, one day. */
export interface ChangeLogEntry {
  id: string
  /** When the change was made. */
  changed_at: string
  /** The attendance day it affected (YYYY-MM-DD). */
  day: string
  event_type: string
  category: ChangeLogCategory
  /** What kind of change, in words ("Record edited", "Appeal approved"). */
  change_label: string
  actor_id: string | null
  /** The person who made it. */
  actor_name: string
  employee_id: string
  employee_name: string
  department: string
  from_status: string | null
  to_status: string | null
  /** Exactly what the person typed, nothing added. */
  comment: string | null
  /** What the system recorded about the change, kept apart from the person's words. */
  details: string | null
  appeal: ChangeLogAppeal | null
}

/**
 * A row of the Change log: one change to one person, covering every day it
 * touched. A bulk change writes one event per person per day, so a month of
 * Out of Station would otherwise list the same thing thirty times.
 */
export interface ChangeLogRow extends Omit<ChangeLogEntry, "day"> {
  /** Every day the change touched, ascending. */
  days: string[]
  day_from: string
  day_to: string
  /** True when the days started from different statuses; from_status is then null. */
  from_mixed: boolean
}

/** Events from one save are written within seconds; this leaves room for a slow bulk request. */
const SAME_CHANGE_WINDOW_MS = 10 * 60 * 1000

/** Single-day edit types: the starting status is part of what was decided, so it must match to merge. */
const EDIT_EVENT_TYPES = new Set(["manual_create", "manual_update", "manual_delete"])

function groupKey(entry: ChangeLogEntry): string {
  return [
    entry.actor_id ?? "",
    entry.employee_id,
    entry.event_type,
    entry.category,
    entry.to_status ?? "",
    entry.comment ?? "",
    entry.details ?? "",
    entry.appeal?.id ?? "",
    EDIT_EVENT_TYPES.has(entry.event_type) ? (entry.from_status ?? "") : "",
  ].join("\u0000")
}

/**
 * Merges the events of one change into one row: same person, same employee,
 * same kind of change, same result, same comment, made within minutes of each
 * other. Appeal decisions never merge (each has its own appeal). Expects
 * entries newest first and returns rows newest first.
 */
export function groupChangeLogEntries(entries: ChangeLogEntry[]): ChangeLogRow[] {
  type Group = { entries: ChangeLogEntry[]; earliestMs: number }
  const groups: Group[] = []
  const openByKey = new Map<string, Group>()

  for (const entry of entries) {
    const key = groupKey(entry)
    const at = Date.parse(entry.changed_at)
    const open = openByKey.get(key)
    if (open && open.earliestMs - at <= SAME_CHANGE_WINDOW_MS) {
      open.entries.push(entry)
      open.earliestMs = Math.min(open.earliestMs, at)
      continue
    }
    const group: Group = { entries: [entry], earliestMs: at }
    groups.push(group)
    openByKey.set(key, group)
  }

  return groups.map(({ entries: members }) => {
    const [latest] = members
    const days = Array.from(new Set(members.map((member) => member.day))).sort()
    const fromStatuses = new Set(members.map((member) => member.from_status ?? ""))
    const fromMixed = fromStatuses.size > 1
    const { day: _day, ...rest } = latest
    void _day
    return {
      ...rest,
      from_status: fromMixed ? null : latest.from_status,
      from_mixed: fromMixed,
      days,
      day_from: days[0],
      day_to: days[days.length - 1],
    }
  })
}

/**
 * Splits a timeline event into the person's own comment and the system's
 * description. New events keep the description in `metadata.summary`; rows
 * written before that (the 1 Oct 2026 appeal backfill) carry it in `comment`
 * and are recognised by their wording.
 */
export function splitChangeComment(event: { comment: string | null; metadata: Record<string, unknown> | null }): {
  comment: string | null
  details: string | null
} {
  const summary = typeof event.metadata?.summary === "string" ? event.metadata.summary : null
  if (summary) return { comment: event.comment?.trim() || null, details: summary }
  const text = event.comment?.trim() || null
  if (text && (text.startsWith("Resolved manually:") || text === "Automatically approved via manual roster update")) {
    return { comment: null, details: text }
  }
  return { comment: text, details: null }
}

type EventLike = {
  event_type: string
  source: string | null
  metadata: Record<string, unknown> | null
}

/** Category and label for one timeline event. */
export function describeChangeEvent(event: EventLike): { category: ChangeLogCategory; label: string } {
  const isOosDirective = event.metadata?.oos_period === true
  switch (event.event_type) {
    case "manual_create":
      return { category: "edits", label: "Record added" }
    case "manual_update":
      return { category: "edits", label: "Record edited" }
    case "manual_delete":
      return { category: "edits", label: "Record deleted" }
    case "bulk_grant":
      return isOosDirective
        ? { category: "out_of_station", label: "Out-of-station directive" }
        : { category: "bulk", label: "Bulk change" }
    case "bulk_delete":
      return { category: "bulk", label: "Bulk removal" }
    case "appeal_approved":
      return { category: "appeals", label: "Appeal approved" }
    case "appeal_rejected":
      return { category: "appeals", label: "Appeal rejected" }
    case "appeal_auto_resolved":
      return { category: "appeals", label: "Appeal resolved by manual change" }
    case "leave_granted":
      return { category: "leave", label: "Leave granted" }
    case "leave_revoked":
      return { category: "leave", label: "Leave revoked" }
    case "exemption_added":
      return { category: "exemptions", label: "Exemption set" }
    case "exemption_removed":
      return { category: "exemptions", label: "Exemption removed" }
    case "oos_stopped":
      return { category: "out_of_station", label: "Out of station stopped" }
    case "holiday_added":
      return { category: "edits", label: "Holiday added" }
    case "holiday_removed":
      return { category: "edits", label: "Holiday removed" }
    default:
      return { category: "edits", label: event.event_type.replaceAll("_", " ") }
  }
}
