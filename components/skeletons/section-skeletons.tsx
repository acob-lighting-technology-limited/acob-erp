import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Placeholders for a section of a page while its data loads — the shape of the
 * content it stands in for, so nothing jumps when the data arrives. Use these
 * instead of a "Loading…" line. Page-level loading uses the page skeletons in
 * this folder; these cover sections, panels and dialogs.
 */

/** A month grid: weekday header and five rows of day cells. */
export function CalendarGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card overflow-hidden rounded-lg border", className)} aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-7 border-b">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="p-2">
            <Skeleton className="mx-auto h-3 w-8" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-14 border-r border-b p-1.5 sm:min-h-16">
            <Skeleton className="h-3 w-5" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Stacked rows — a leaderboard, a holiday list, a register. */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** A lunch menu: a title, the day's items and the vote line. */
export function MenuSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-lg border p-5", className)} aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  )
}

/** A few lines of text — a short panel, an expanded row, a dialog body. */
export function LinesSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 py-2", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-1/2" : "w-full")} />
      ))}
    </div>
  )
}
