import { addOneMonthISO, type StarlinkMailKind } from "@/lib/starlink/billing-mail"

/**
 * How long after a bill arrives with no "Payment Failed" before its month counts
 * as paid. Starlink sends no confirmation when autopay works first time, and its
 * failure emails arrive within hours of the bill.
 */
export const AUTOPAY_GRACE_DAYS = 3

export type BillingEventForSchedule = {
  kind: StarlinkMailKind
  receivedAt: string
  /** The billing month a bill or processed payment belongs to. */
  periodStart: string | null
  /** A "Payment Processed" whose bill has not been seen yet. */
  waiting?: boolean
}

export type SchedulePlan = {
  /** The new next_payment_due: the first month not yet paid. */
  nextDue: string
  /** Months newly counted as paid, oldest first. */
  monthsPaid: string[]
  /** Months with failed payments and no successful retry. */
  unpaid: string[]
}

/**
 * How a billed month stands:
 * - confirmed: Starlink sent "Payment Processed" naming its invoice;
 * - autopay: the grace period passed with no "Payment Failed" (Starlink sends
 *   nothing when autopay works first time);
 * - failed: a payment failed and no "Processed" has followed;
 * - pending: billed within the grace period, nothing heard yet.
 */
export type StarlinkMonthStatus = "confirmed" | "autopay" | "failed" | "pending"

export type StarlinkMonth = {
  periodStart: string
  status: StarlinkMonthStatus
  /** Number of "Payment Failed" emails for the month. */
  failedAttempts: number
}

export function isPaidStatus(status: StarlinkMonthStatus): boolean {
  return status === "confirmed" || status === "autopay"
}

/**
 * Starlink's emails, per kit, as observed Jan-Oct 2026:
 * - every month gets a bill ("Automatic Payment Reminder");
 * - autopay that works first time sends nothing more;
 * - a failed charge sends "Payment Failed", and a later successful retry or
 *   manual payment sends "Payment Processed" naming that month's invoice.
 *
 * Returns every billed month, oldest first, with its status.
 */
export function classifyStarlinkMonths(events: BillingEventForSchedule[], now: Date): StarlinkMonth[] {
  type Tally = { periodStart: string; billedAt: string; failed: number; processed: boolean }
  const sorted = [...events].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  const months = new Map<string, Tally>()
  let latestBill: Tally | null = null

  for (const event of sorted) {
    if (event.kind === "reminder" && event.periodStart) {
      const month = months.get(event.periodStart) ?? {
        periodStart: event.periodStart,
        billedAt: event.receivedAt,
        failed: 0,
        processed: false,
      }
      months.set(event.periodStart, month)
      latestBill = month
    } else if (event.kind === "failed") {
      // A failure belongs to the latest bill before it.
      if (latestBill) latestBill.failed += 1
    } else if (event.kind === "processed" && event.periodStart && !event.waiting) {
      const month = months.get(event.periodStart)
      if (month) month.processed = true
    }
  }

  const graceMs = AUTOPAY_GRACE_DAYS * 24 * 60 * 60 * 1000
  return [...months.values()]
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((m) => ({
      periodStart: m.periodStart,
      failedAttempts: m.failed,
      status: m.processed
        ? "confirmed"
        : m.failed > 0
          ? "failed"
          : now.getTime() - Date.parse(m.billedAt) >= graceMs
            ? "autopay"
            : "pending",
    }))
}

/**
 * Returns the schedule move from `currentDue`, or null when nothing changes.
 * The schedule only moves forward, and stops at the first month not known paid.
 */
export function reconcileStarlinkSchedule(
  currentDue: string | null,
  events: BillingEventForSchedule[],
  now: Date
): SchedulePlan | null {
  const months = classifyStarlinkMonths(events, now)
  const unpaid = months.filter((m) => m.status === "failed").map((m) => m.periodStart)

  const monthsPaid: string[] = []
  let nextDue = currentDue
  for (const month of months) {
    if (nextDue && month.periodStart < nextDue) continue // already settled before this sync
    // A whole month with no bill on record: don't paper over it.
    if (nextDue && month.periodStart >= addOneMonthISO(nextDue)) break
    if (!isPaidStatus(month.status)) break
    monthsPaid.push(month.periodStart)
    nextDue = addOneMonthISO(month.periodStart)
  }

  if (monthsPaid.length === 0 || !nextDue) return null
  return { nextDue, monthsPaid, unpaid }
}
