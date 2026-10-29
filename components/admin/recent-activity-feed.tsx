import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ScrollText } from "lucide-react"
import { EmptyState } from "@/components/ui/patterns"
import type { RecentActivityItem } from "./dashboard-types"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/format"
import { ADMIN_BASE, shellBackHref } from "@/lib/dept/shell-links"

const activityRouteMap: Record<string, string> = {
  task: "/admin/tasks",
  tasks: "/admin/tasks",
  feedback: "/admin/feedback",
  profile: "/admin/hr/employees",
  profiles: "/admin/hr/employees",
  pending_user: "/admin/hr/employees",
  pending_users: "/admin/hr/employees",
  department_payments: "/admin/accounts/payments",
  payment_documents: "/admin/accounts/payments",
  help_desk_ticket: "/admin/help-desk/management",
  help_desk_tickets: "/admin/help-desk/management",
  correspondence_record: "/admin/correspondence",
  correspondence_records: "/admin/correspondence",
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

interface RecentActivityFeedProps {
  activity: RecentActivityItem[]
  showViewAll?: boolean
  className?: string
  /** "/admin" (default) or "/dept/<id>": the shell these links should stay inside. */
  basePath?: string
}

export function RecentActivityFeed({
  activity,
  showViewAll = true,
  className,
  basePath = ADMIN_BASE,
}: RecentActivityFeedProps) {
  return (
    <Card className={cn("flex min-h-0 flex-col", className)}>
      <CardHeader className="shrink-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScrollText className="text-muted-foreground h-4 w-4" />
            Recent Activity
          </CardTitle>
          {showViewAll && (
            <Link
              href={shellBackHref("/admin/audit-logs", basePath)}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              View all →
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {activity.length > 0 ? (
          <ul className="max-h-72 flex-1 divide-y overflow-y-auto border-t lg:max-h-none">
            {activity.map((item) => {
              const href = shellBackHref(resolveActivityRoute(item.moduleKey), basePath)
              const rowClass = "hover:bg-muted/50 flex items-center gap-3 px-4 py-2.5 transition-colors"
              const body = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{item.actorName}</span> <span>{item.actionLabel}</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                        {item.moduleLabel}
                      </Badge>
                      <span className="text-muted-foreground text-xs" suppressHydrationWarning>
                        {formatRelative(item.createdAt)}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                </>
              )
              return (
                <li key={item.id}>
                  {/* a module with no page in a dept console falls back to the console's home: not worth a link */}
                  {href === basePath ? (
                    <div className={rowClass}>{body}</div>
                  ) : (
                    <Link href={href} className={rowClass}>
                      {body}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            title="No recent system activity found"
            description="Recent audit activity will appear here as users interact with modules."
            icon={ScrollText}
            className="border-0 py-8"
          />
        )}
      </CardContent>
    </Card>
  )
}
