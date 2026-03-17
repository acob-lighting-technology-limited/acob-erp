import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Info, AlertCircle, AlertTriangle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/patterns"
import type { NotificationItem, NotificationType } from "./dashboard-types"

const notificationStyles: Record<
  NotificationType,
  { cardClass: string; badgeClass: string; icon: LucideIcon; label: string }
> = {
  error: {
    cardClass: "border-red-200/70 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/25",
    badgeClass: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
    icon: AlertCircle,
    label: "Critical",
  },
  warning: {
    cardClass: "border-amber-200/70 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25",
    badgeClass: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300",
    icon: AlertTriangle,
    label: "Attention",
  },
  info: {
    cardClass: "border-blue-200/70 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/25",
    badgeClass: "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300",
    icon: Info,
    label: "Info",
  },
}

interface ActionQueueProps {
  notifications: NotificationItem[]
}

export function ActionQueue({ notifications }: ActionQueueProps) {
  if (notifications.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center p-8">
          <EmptyState
            title="No immediate operational alerts"
            description="Critical alerts will appear here when detected."
            icon={Info}
            className="w-full border-0 p-2"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {notifications.map((item) => {
        const styles = notificationStyles[item.type]
        const SeverityIcon = styles.icon

        return (
          <Card key={item.id} className={cn("border", styles.cardClass)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <SeverityIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Badge variant="outline" className={styles.badgeClass}>
                      {styles.label}
                    </Badge>
                    <span className="text-muted-foreground text-xs">{item.timestamp}</span>
                  </div>
                  <p className="text-muted-foreground text-sm">{item.message}</p>
                  <Link
                    href={item.link}
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-medium"
                  >
                    {item.linkText}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
