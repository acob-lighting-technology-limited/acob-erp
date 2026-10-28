import type { ComponentProps } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DetailPageSkeleton } from "@/components/skeletons/detail-page-skeleton"
import { FormPageSkeleton } from "@/components/skeletons/form-page-skeleton"

/** Generic table/list skeleton — use when loading tabular data */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex gap-4">
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
        <Skeleton key={`skeleton-${i}`} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  )
}

type FormLoaderProps = { variant: "form" } & ComponentProps<typeof FormPageSkeleton>
type DetailLoaderProps = { variant?: "detail" } & ComponentProps<typeof DetailPageSkeleton>

/**
 * Initial load of a whole page: the page's skeleton, not a spinner (audit 8.3),
 * so the layout does not jump when the data arrives. `form` for settings and
 * edit pages, `detail` (default) for record pages.
 *
 * Pass the same props the route's `loading.tsx` passes. The two skeletons are shown back to back (the
 * route's, then this one while the query runs), and if they differ the layout visibly changes shape.
 */
export function PageLoader(props: FormLoaderProps | DetailLoaderProps = {}) {
  if (props.variant === "form") {
    return (
      <FormPageSkeleton
        sections={props.sections}
        fieldsPerSection={props.fieldsPerSection}
        showSidebar={props.showSidebar}
      />
    )
  }
  return <DetailPageSkeleton sections={props.sections} showSidebar={props.showSidebar} />
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
