import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Generic table/list skeleton — use when loading tabular data */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Generic card grid skeleton */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  )
}

/** Full-page centred spinner for initial page loads */
export function PageLoader() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
    </div>
  )
}

/** Inline error state with optional retry button */
export function QueryError({ message = "Something went wrong.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center gap-3 rounded-lg border p-6 text-center">
      <AlertCircle className="text-destructive h-6 w-6" />
      <p className="text-destructive text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** Empty state — for when query succeeds but returns no data */
export function EmptyState({ message = "No data found." }: { message?: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}
