import { Children, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The one place the stats-band layout rule lives.
 *
 * A phone gets a **single row, three cards at most**. Anything beyond the third
 * is dropped below `sm` and comes back from `sm` up, so a narrow screen never
 * spends two rows on metrics before the data starts. Every page used to
 * hand-write this grid, which is why 82 of them wrapped to a second row: the
 * rule was a convention no component enforced.
 *
 * Priority is **source order** — the first three children survive on mobile.
 * That is the whole API on purpose. A page that wants a different card on a
 * phone reorders its JSX; there is no `priority` prop to get out of sync with
 * what the reader actually sees.
 */
interface StatGridProps {
  children: ReactNode
  className?: string
}

/**
 * Tailwind scans source for complete class names, so these cannot be built by
 * interpolation — every column count a page can produce is spelled out here.
 *
 * Mobile is `min(count, 3)`. From `sm` the full set returns; six across is too
 * tight for a tablet, so it holds at three until `lg`.
 */
const GRID_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-3 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-3 lg:grid-cols-6",
}

export function StatGrid({ children, className }: StatGridProps) {
  // `toArray` drops the `null`/`false` that a conditionally rendered card leaves
  // behind, so the column count matches the DOM the nth-child rules below see.
  const count = Children.toArray(children).length
  if (count === 0) return null

  return (
    <div
      className={cn(
        "grid gap-2 sm:gap-3",
        GRID_COLUMNS[count] ?? "grid-cols-3 sm:grid-cols-3 lg:grid-cols-6",
        // Applied to the container rather than wrapping each card, so swapping a
        // hand-written grid for this component changes no DOM and cannot disturb
        // a card's own layout.
        count > 3 && "[&>*:nth-child(n+4)]:hidden sm:[&>*:nth-child(n+4)]:block",
        className
      )}
    >
      {children}
    </div>
  )
}
