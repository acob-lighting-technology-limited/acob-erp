import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface FormPageSkeletonProps {
  /** Number of form sections/cards */
  sections?: number
  /** Number of fields per section */
  fieldsPerSection?: number
  /** Whether to show a sidebar */
  showSidebar?: boolean
}

/**
 * Form page skeleton for loading states.
 * Shows form sections with field skeletons.
 */
export function FormPageSkeleton({ sections = 2, fieldsPerSection = 4, showSidebar = true }: FormPageSkeletonProps) {
  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-5 w-64" />
          </div>
        </div>

        {/* Form Grid */}
        <div className={showSidebar ? "grid gap-6 lg:grid-cols-3" : ""}>
          {/* Main Form */}
          <div className={showSidebar ? "space-y-6 lg:col-span-2" : "space-y-6"}>
            {[...Array(sections)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[...Array(fieldsPerSection)].map((_, j) => (
                      <div key={j} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
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
                  <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Skeleton className="h-10 w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
