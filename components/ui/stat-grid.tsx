import { Children, isValidElement, type ReactElement, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The one place the stats-band layout rule lives.
 *
 * A phone gets a **single line of metrics** (`12 Staff · 3 Pending · …`) that scrolls sideways if it must,
 * instead of cards: a card spends height a phone would rather spend on the data. From `sm` up the same
 * cards return as a grid. The line is derived from the cards themselves (their `title` and `value`), so a
 * page writes its metrics once and cannot let the two renderings disagree.
 *
 * A grid whose children are not plain `StatCard`s (a custom tile, say) cannot be reduced to a line, so it
 * keeps the older rule: one row of three cards at most on a phone, the rest from `sm`.
 *
 * Priority is **source order**: the first metrics are the ones a narrow screen shows first.
 */
interface StatGridProps {
  children: ReactNode
  className?: string
}

/**
 * Tailwind scans source for complete class names, so these cannot be built by interpolation: every column
 * count a page can produce is spelled out here.
 */
const SM_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
}

/** The fallback used when the children cannot be shown as a line. */
const GRID_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-3 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-3 lg:grid-cols-6",
}

interface LineMetric {
  title: string
  value: string | number
}

/** A child is a line metric when it carries a string `title` and a `value`, as every StatCard does. */
function toLineMetric(node: ReactNode): LineMetric | null {
  if (!isValidElement(node)) return null
  const props = (node as ReactElement<{ title?: unknown; value?: unknown }>).props
  const { title, value } = props
  if (typeof title !== "string") return null
  if (typeof value !== "string" && typeof value !== "number") return null
  return { title, value }
}

export function StatGrid({ children, className }: StatGridProps) {
  // `toArray` drops the `null`/`false` that a conditionally rendered card leaves behind, so the column
  // count matches the DOM.
  const items = Children.toArray(children)
  const count = items.length
  if (count === 0) return null

  const metrics = items.map(toLineMetric)
  const canBeLine = metrics.every((m): m is LineMetric => m !== null)

  if (!canBeLine) {
    return (
      <div
        className={cn(
          "grid gap-2 sm:gap-3",
          GRID_COLUMNS[count] ?? "grid-cols-3 sm:grid-cols-3 lg:grid-cols-6",
          count > 3 && "[&>*:nth-child(n+4)]:hidden sm:[&>*:nth-child(n+4)]:block",
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <>
      <ul
        aria-label="Summary"
        className="text-muted-foreground flex items-center gap-x-2 overflow-x-auto text-xs whitespace-nowrap sm:hidden [&::-webkit-scrollbar]:hidden"
      >
        {(metrics as LineMetric[]).map((metric) => (
          <li
            key={metric.title}
            className="bg-card inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5"
          >
            <span className="text-foreground font-semibold">{metric.value}</span>
            <span>{metric.title}</span>
          </li>
        ))}
      </ul>
      <div className={cn("hidden gap-3 sm:grid", SM_COLUMNS[count] ?? "sm:grid-cols-3 lg:grid-cols-6", className)}>
        {children}
      </div>
    </>
  )
}
