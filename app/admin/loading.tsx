import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>

          {/* Filters skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>

          {/* Table skeleton */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full divide-y divide-border">
                  {/* Table header */}
                  <div className="flex gap-4 p-4 bg-muted/50">
                    {[...Array(9)].map((_, i) => (
                      <Skeleton key={i} className="h-4 w-24" />
                    ))}
                  </div>
                  {/* Table rows */}
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 border-t">
                      {[...Array(9)].map((_, j) => (
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
    </div>
  )
}
