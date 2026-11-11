"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ATTENDANCE_STATUS_LABELS, type UnifiedAttendanceStatus } from "@/lib/hr/attendance-status"
import type { DayFlag, ReviewItem } from "@/lib/hr/bulk-day-review"
import { formatWATDate } from "@/lib/utils/date"

export type BulkReview = {
  status_label: string
  people: Array<{ user_id: string; name: string; total: number; will_stage: number; items: ReviewItem[] }>
}

const day = (date: string) => formatWATDate(date, { month: "short", day: "numeric" })

/** "28 – 30 Oct, 2 Nov": runs of consecutive dates collapsed so a long range stays readable. */
function ranges(dates: string[]): string {
  const runs: Array<[string, string]> = []
  for (const date of dates) {
    const last = runs[runs.length - 1]
    const gap = last ? (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${last[1]}T00:00:00Z`)) / 86_400_000 : 0
    if (last && gap === 1) last[1] = date
    else runs.push([date, date])
  }
  return runs.map(([a, b]) => (a === b ? day(a) : `${day(a)} – ${day(b)}`)).join(", ")
}

function describe(item: ReviewItem, applying: string): { tone: "skip" | "change"; text: string } {
  const skipped = item.action === "skip"
  const existing = item.existingStatus
    ? (ATTENDANCE_STATUS_LABELS[item.existingStatus as UnifiedAttendanceStatus] ?? item.existingStatus)
    : "manual"
  const text: Record<DayFlag, string> = {
    present: skipped
      ? "clocked in and out, so they were in the office. Skipped."
      : `clocked in and out. ${applying} will override the day; the clock-ins are kept.`,
    clock_in: `a clock-in but no clock-out (looks like they left mid-day). ${applying} will override it; the clock-in is kept and restored if you remove this entry.`,
    same_status: `already ${applying}. Skipped, so the range starts later for this person.`,
    other_manual: `already has a manual ${existing} entry. It will be replaced.`,
    pending: "a change is already waiting on this day. Skipped.",
    on_leave: `on approved leave. Leave shows ahead of ${applying} on these days.`,
  }
  return { tone: skipped ? "skip" : "change", text: text[item.kind] }
}

/**
 * Shown before a bulk apply when any day already has a clock-in, an existing OOS, or another
 * manual bypass. Lists, per person, what is on those days and what the apply will do with them,
 * so a range that silently starts later (or overrides a clock-in) is never a surprise.
 */
export function BulkApplyReviewDialog({
  review,
  busy,
  onCancel,
  onConfirm,
}: {
  review: BulkReview | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const stageable = review?.people.reduce((sum, p) => sum + p.will_stage, 0) ?? 0
  return (
    <Dialog open={review !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review before applying {review?.status_label}</DialogTitle>
          <DialogDescription>
            Some of these days already have something on them. Nothing is applied until you confirm, and it then still
            needs the Department Lead&apos;s confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {review?.people
            .filter((p) => p.items.length > 0)
            .map((p) => (
              <section key={p.user_id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold">{p.name}</h4>
                  <span className="text-muted-foreground text-xs">
                    {p.will_stage} of {p.total} day(s) will be staged
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {p.items.map((item) => {
                    const { tone, text } = describe(item, review.status_label)
                    return (
                      <li key={`${item.kind}-${item.action}-${item.existingStatus ?? ""}`} className="flex gap-2">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "skip" ? "bg-muted-foreground" : "bg-warning"}`}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium">{ranges(item.dates)}</span> — {text}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          {stageable === 0 && (
            <p className="text-muted-foreground text-sm">
              Every day here is skipped, so applying would change nothing.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {stageable === 0 ? "Close" : "Cancel"}
          </Button>
          {stageable > 0 && (
            <Button onClick={onConfirm} disabled={busy}>
              {busy ? "Applying…" : `Apply ${stageable} day(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
