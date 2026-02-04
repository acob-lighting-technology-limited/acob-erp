import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ProfileLoading() {
  return (
    <div className="container mx-auto max-w-full space-y-6 p-4 md:p-6 lg:p-8">
      {/* Profile Hero Card Skeleton */}
      <Card className="relative overflow-hidden">
        {/* Edit Button Skeleton */}
        <Skeleton className="absolute top-4 right-4 h-9 w-28" />

        {/* Banner Skeleton */}
        <Skeleton className="h-28 rounded-none md:h-36 lg:h-44" />

        <CardContent className="relative px-6 pb-6">
          {/* Avatar and Name Skeleton */}
          <div className="-mt-14 flex items-end gap-4 md:-mt-16 lg:-mt-20 lg:gap-6">
            <Skeleton className="border-background h-28 w-28 rounded-full border-4 md:h-32 md:w-32 lg:h-40 lg:w-40" />
            <div className="space-y-2 pb-2 lg:pb-4">
              <Skeleton className="h-7 w-48 md:h-8 md:w-64 lg:h-9" />
              <Skeleton className="h-4 w-32 md:h-5 md:w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>

          {/* Badges Skeleton */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information Skeleton */}
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Skeleton */}
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Skeleton */}
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          {/* Tabs Skeleton */}
          <div className="mb-4 flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-md" />
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="space-y-3 rounded-lg border p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
