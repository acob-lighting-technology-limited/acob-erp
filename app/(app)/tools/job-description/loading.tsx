import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function JobDescriptionLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Job Description Cards */}
      <div className="grid gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex flex-wrap gap-2">
                    {[...Array(4)].map((_, j) => (
                      <Skeleton key={j} className="h-6 w-24" />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <div className="flex flex-wrap gap-2">
                    {[...Array(3)].map((_, j) => (
                      <Skeleton key={j} className="h-6 w-32" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
