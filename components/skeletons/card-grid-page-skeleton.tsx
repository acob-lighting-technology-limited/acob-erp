import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface CardGridPageSkeletonProps {
  cards?: number
  columns?: 2 | 3 | 4
}

export function CardGridPageSkeleton({ cards = 3, columns = 3 }: CardGridPageSkeletonProps) {
  const gridCols =
    columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className={`grid gap-6 ${gridCols}`}>
          {[...Array(cards)].map((_, i) => (
            <Card key={i} className="border-2">
              <CardHeader className="flex flex-row items-start gap-4 pb-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-4 w-44 max-w-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
