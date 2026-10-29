import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs"

// Placeholders are a fixed count, so each gets a stable key of its own rather than its index.
const slots = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${i}`)
export function EmployeeDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Back button */}
      <Skeleton className="h-10 w-32" />

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 md:flex-row">
            <Skeleton className="h-24 w-24 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {slots("field", 6).map((key) => (
                  <div key={key} className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {slots("tab", 4).map((key) => (
            <Skeleton key={key} className="h-10 w-full" />
          ))}
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {slots("card", 3).map((key) => (
            <Card key={key}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
