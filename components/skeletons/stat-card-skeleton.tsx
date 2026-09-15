import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatGrid } from "@/components/ui/stat-grid"

/**
 * Placeholder for `<StatCard variant="compact">` — the only StatCard anatomy the
 * app renders. Each row is pinned to the real card's line box (title
 * `text-[10px]`/`sm:text-xs` leading-tight, value `text-base`/`sm:text-xl`
 * leading-tight, icon chip `p-1.5`/`sm:p-2`) so the card is the same height
 * before and after mount, not merely a similar one.
 */
export function StatCardSkeleton() {
  return (
    <Card className="border">
      <CardContent className="p-2.5 sm:p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex h-[12.5px] items-center sm:h-[15px]">
              <Skeleton className="h-2 w-14 sm:h-2.5 sm:w-16" />
            </div>
            <div className="mt-0.5 flex h-5 items-center sm:h-[25px]">
              <Skeleton className="h-4 w-10 sm:h-5 sm:w-12" />
            </div>
          </div>
          <Skeleton className="h-[26px] w-[26px] shrink-0 sm:h-8 sm:w-8 sm:rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * A stats band of `count` placeholders laid out by the real `StatGrid`, so the
 * column count and the three-on-a-phone rule come from the same place as the
 * mounted page rather than a hand-copied grid.
 */
export function StatGridSkeleton({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <StatGrid className={className}>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </StatGrid>
  )
}
