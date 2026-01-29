import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface TablePageSkeletonProps {
  /** Number of filter controls */
  filters?: number
  /** Number of table columns */
  columns?: number
  /** Number of table rows */
  rows?: number
  /** Whether to show stat cards above the table */
  showStats?: boolean
  /** Number of stat cards */
  statCards?: number
}

/**
 * Table/list page skeleton for loading states.
 * Shows optional stats, filters, and table rows.
 */
export function TablePageSkeleton({
  filters = 3,
  columns = 6,
  rows = 8,
  showStats = false,
  statCards = 4,
}: TablePageSkeletonProps) {
  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-80" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Stats (optional) */}
        {showStats && (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(statCards)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              {[...Array(filters)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-40" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="divide-border min-w-full divide-y">
                {/* Table header */}
                <div className="bg-muted/50 flex gap-4 p-4">
                  {[...Array(columns)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-24" />
                  ))}
                </div>
                {/* Table rows */}
                {[...Array(rows)].map((_, i) => (
                  <div key={i} className="flex gap-4 border-t p-4">
                    {[...Array(columns)].map((_, j) => (
                      <Skeleton key={j} className="h-4 w-24" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
