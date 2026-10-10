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

type Month = { periodStart: string; billedAt: string; failed: number; processed: boolean }

/**
 * Starlink's emails, per kit, as observed Jan-Oct 2026:
 * - every month gets a bill ("Automatic Payment Reminder");
 * - autopay that works first time sends nothing more;
 * - a failed charge sends "Payment Failed", and a later successful retry or
 *   manual payment sends "Payment Processed" naming that month's invoice.
 *
 * So a month is paid when a "Processed" names it, or when the grace period has
 * passed with no failure. A month with failures and no "Processed" is unpaid.
 *
 * Returns the schedule move from `currentDue`, or null when nothing changes.
 * The schedule only moves forward, and stops at the first month not known paid.
 */
export function reconcileStarlinkSchedule(
  currentDue: string | null,
  events: BillingEventForSchedule[],
  now: Date
): SchedulePlan | null {
  const sorted = [...events].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  const months = new Map<string, Month>()
  let latestBill: Month | null = null

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
  const ordered = [...months.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  const isPaid = (m: Month) => m.processed || (m.failed === 0 && now.getTime() - Date.parse(m.billedAt) >= graceMs)
  const unpaid = ordered.filter((m) => m.failed > 0 && !m.processed).map((m) => m.periodStart)

  const monthsPaid: string[] = []
  let nextDue = currentDue
  for (const month of ordered) {
    if (nextDue && month.periodStart < nextDue) continue // already settled before this sync
    // A whole month with no bill on record: don't paper over it.
    if (nextDue && month.periodStart >= addOneMonthISO(nextDue)) break
    if (!isPaid(month)) break
    monthsPaid.push(month.periodStart)
    nextDue = addOneMonthISO(month.periodStart)
  }

  if (monthsPaid.length === 0 || !nextDue) return null
  return { nextDue, monthsPaid, unpaid }
}
