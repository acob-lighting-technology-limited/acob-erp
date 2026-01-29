import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface DetailPageSkeletonProps {
  /** Whether to show a sidebar with meta info */
  showSidebar?: boolean
  /** Number of detail sections */
  sections?: number
}

/**
 * Detail/view page skeleton for loading states.
 * Shows header, main content, and optional sidebar.
 */
export function DetailPageSkeleton({ showSidebar = true, sections = 2 }: DetailPageSkeletonProps) {
  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="mb-2 h-4 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>

        {/* Content Grid */}
        <div className={showSidebar ? "grid gap-6 md:grid-cols-3" : ""}>
          {/* Main Content */}
          <div className={showSidebar ? "space-y-6 md:col-span-2" : "space-y-6"}>
            {[...Array(sections)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="mt-1 h-8 w-32" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="mt-1 h-6 w-28" />
                    </div>
                  </div>
                  <div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-16 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sidebar */}
          {showSidebar && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="mt-1 h-4 w-32" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
