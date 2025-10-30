import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AdminFeedbackLoading() {
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
              <div className="flex gap-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-48" />
              </div>
            </CardContent>
          </Card>

          {/* Feedback table skeleton */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full divide-y divide-border">
                  {/* Table header */}
                  <div className="flex gap-4 p-4 bg-muted/50">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-4 w-32" />
                    ))}
                  </div>
                  {/* Table rows */}
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 border-t">
                      {[...Array(6)].map((_, j) => (
                        <Skeleton key={j} className="h-4 w-32" />
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
