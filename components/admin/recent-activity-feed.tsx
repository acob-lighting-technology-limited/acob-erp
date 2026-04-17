import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ScrollText } from "lucide-react"
import { EmptyState } from "@/components/ui/patterns"
import type { RecentActivityItem } from "./dashboard-types"

const activityRouteMap: Record<string, string> = {
  task: "/admin/tasks",
  tasks: "/admin/tasks",
  feedback: "/admin/feedback",
  profile: "/admin/hr/employees",
  profiles: "/admin/hr/employees",
  pending_user: "/admin/hr/employees",
  pending_users: "/admin/hr/employees",
  department_payments: "/admin/finance/payments",
  payment_documents: "/admin/finance/payments",
  help_desk_ticket: "/admin/help-desk",
  help_desk_tickets: "/admin/help-desk",
  correspondence_record: "/admin/tools/reference-generator",
  correspondence_records: "/admin/tools/reference-generator",
  asset: "/admin/assets",
  assets: "/admin/assets",
  asset_assignment: "/admin/assets",
  asset_assignments: "/admin/assets",
  audit_log: "/admin/audit-logs",
  audit_logs: "/admin/audit-logs",
}

function resolveActivityRoute(moduleKey: string): string {
  return activityRouteMap[moduleKey] || "/admin/audit-logs"
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface RecentActivityFeedProps {
  activity: RecentActivityItem[]
}

export function RecentActivityFeed({ activity }: RecentActivityFeedProps) {
  return (
    <Card className="border">
      <CardHeader className="bg-muted/30 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <ScrollText className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          <Link href="/admin/audit-logs">
            <Badge variant="outline" className="hover:bg-accent cursor-pointer text-xs">
              View All
            </Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {activity.length > 0 ? (
          <div className="divide-y">
            {activity.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    <span className="font-semibold">{item.actorName}</span> {item.actionLabel}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.moduleLabel}
                    </Badge>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
                <Link
                  href={resolveActivityRoute(item.moduleKey)}
                  className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-1 text-xs font-medium"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No recent system activity found"
            description="Recent audit activity will appear here as users interact with modules."
            icon={ScrollText}
            className="border-0 p-4"
          />
        )}
      </CardContent>
    </Card>
  )
}
