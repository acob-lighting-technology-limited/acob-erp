/**
 * What applying a bulk status (OOS, waiver, a permission) does to each person's day, and what
 * the admin should be told first. One function decides it, and both the preview ("dry run") and
 * the real apply use it, so the dialog can never promise something the apply does not do.
 *
 * Before this, days that were already covered were skipped without a word: an OOS range for
 * someone whose first days were already OOS simply started later, and nobody saw why.
 */

export type DayFlag =
  /** A clock-in and a clock-out: they were in the office. OOS skips the day; a waiver overrides it. */
  | "present"
  /** A clock-in but no clock-out (left mid-day). Overridden; the punch is kept. */
  | "clock_in"
  /** The day already has this status. Skipped. */
  | "same_status"
  /** A different manual entry (a waiver, a permission, another OOS). Replaced once confirmed. */
  | "other_manual"
  /** A change is already waiting on this day. Skipped. */
  | "pending"
  /** Approved (or MD-pending) leave covers the day, and leave shows ahead of a status. */
  | "on_leave"

export type DayReview = {
  date: string
  action: "stage" | "skip"
  flags: DayFlag[]
  /** The existing entry's status, for "other_manual". */
  existingStatus?: string
}

export type ExistingDay = {
  status: string
  clock_in: string | null
  clock_out: string | null
  source: string | null
}

export function classifyBulkDay(input: {
  status: string
  date: string
  existing: ExistingDay | null
  hasPending: boolean
  onLeave: boolean
}): DayReview {
  const { status, date, existing } = input
  const flags: DayFlag[] = []
  const result = (action: DayReview["action"], existingStatus?: string): DayReview => ({
    date,
    action,
    flags: input.onLeave ? [...flags, "on_leave"] : flags,
    ...(existingStatus ? { existingStatus } : {}),
  })

  if (input.hasPending) {
    flags.push("pending")
    return result("skip")
  }

  const complete = Boolean(existing?.clock_in && existing?.clock_out)
  const incomplete = Boolean(existing && (existing.clock_in || existing.clock_out) && !complete)

  // OOS never overrides a fully-present day: the person was demonstrably in the office. A day
  // with a clock-in but no clock-out is the "clocked in, then left for OOS" case, which IS a
  // legitimate override. A waiver keeps overriding any day, since its purpose is to forgive one.
  if (status === "out_of_station" && complete) {
    flags.push("present")
    return result("skip")
  }
  if (existing?.status === status) {
    flags.push("same_status")
    return result("skip")
  }

  if (complete) flags.push("present")
  else if (incomplete) flags.push("clock_in")
  else if (existing?.source === "manual") {
    flags.push("other_manual")
    return result("stage", existing.status)
  }
  return result("stage")
}

export type ReviewItem = {
  kind: DayFlag
  /** What happens to these days. */
  action: "stage" | "skip"
  existingStatus?: string
  dates: string[]
}

/** Groups a person's reviewed days by what they have and what will happen, oldest first. */
export function summarizeDays(days: DayReview[]): ReviewItem[] {
  const items = new Map<string, ReviewItem>()
  for (const day of days) {
    for (const kind of day.flags) {
      const key = `${kind}|${day.action}|${day.existingStatus ?? ""}`
      const item = items.get(key) ?? {
        kind,
        action: day.action,
        ...(day.existingStatus ? { existingStatus: day.existingStatus } : {}),
        dates: [],
      }
      item.dates.push(day.date)
      items.set(key, item)
    }
  }
  return [...items.values()].map((item) => ({ ...item, dates: item.dates.sort() }))
}
