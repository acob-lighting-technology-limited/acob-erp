import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/patterns"
import { Plane, UserCheck } from "lucide-react"
import { formatWATDate } from "@/lib/utils/date"
import type { AwayTodayItem } from "@/lib/admin/away-today"
import { cn } from "@/lib/utils"

/**
 * Who is legitimately away today: approved leave and Out of Station.
 *
 * "Clocked in X of Y" cannot tell an admin whether the gap is absence or
 * people who are meant to be elsewhere; this is the other half of that
 * number. Deliberately not a "not clocked in" list - that needs the full
 * exemption/OOS/leave precedence to avoid naming people who are excused.
 */

const REASON_CLASSES: Record<AwayTodayItem["reason"], string> = {
  leave: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  out_of_station: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
}

function untilLabel(item: AwayTodayItem, todayIso: string): string {
  if (item.indefinite) return "Until further notice"
  if (!item.until) return ""
  if (item.until === todayIso) return "Back next working day"
  return `Until ${formatWATDate(item.until, { weekday: "short", month: "short", day: "numeric" })}`
}

export function AwayToday({
  items,
  todayIso,
  className,
}: {
  items: AwayTodayItem[]
  todayIso: string
  className?: string
}) {
  return (
    <Card className={cn("flex min-h-0 flex-col", className)}>
      <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plane className="text-muted-foreground h-4 w-4" />
          Away today
          {items.length > 0 && (
            <span className="text-muted-foreground text-xs font-normal tabular-nums">({items.length})</span>
          )}
        </CardTitle>
        <Link href="/admin/hr/leave" className="text-muted-foreground hover:text-foreground text-xs transition-colors">
          Leave →
        </Link>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {items.length > 0 ? (
          <ul className="max-h-72 flex-1 divide-y overflow-y-auto border-t lg:max-h-none">
            {items.map((item) => (
              <li key={`${item.reason}-${item.userId}`} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {[item.department, untilLabel(item, todayIso)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge className={`shrink-0 px-1.5 py-0 text-[10px] ${REASON_CLASSES[item.reason]}`}>
                  {item.label}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 items-center justify-center border-t px-6 py-8">
            <EmptyState
              title="Everyone is in"
              description="Staff on approved leave or out of station today will appear here."
              icon={UserCheck}
              className="border-0 py-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
