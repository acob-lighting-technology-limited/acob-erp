import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/patterns"
import type { ActionQueueItem, ActionQueueTone } from "./dashboard-types"

/**
 * A list of counts that link to where the work is done. The dashboard uses
 * two: "Pending approvals" (only an admin can unblock these) and "Needs
 * attention" (late or stuck work).
 *
 * The earlier version rendered every alert as its own tinted card in a
 * two-column grid, so a normal day looked like an incident. Here severity is
 * carried by the count's colour alone and empty rows are left out.
 */

const COUNT_TONES: Record<ActionQueueTone, string> = {
  critical: "text-red-600 dark:text-red-400",
  attention: "text-amber-600 dark:text-amber-400",
  info: "text-foreground",
}

interface ActionQueueProps {
  title: string
  icon: LucideIcon
  items: ActionQueueItem[]
  emptyTitle: string
  emptyDescription: string
  className?: string
}

export function ActionQueue({ title, icon: Icon, items, emptyTitle, emptyDescription, className }: ActionQueueProps) {
  const pending = items.filter((item) => item.count > 0)
  const total = pending.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card className={cn("flex min-h-0 flex-col", className)}>
      <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="text-muted-foreground h-4 w-4" />
          {title}
          {total > 0 && <span className="text-muted-foreground text-xs font-normal tabular-nums">({total})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {pending.length > 0 ? (
          <ul className="flex-1 divide-y overflow-y-auto border-t">
            {pending.map((item) => (
              <li key={item.id} className="hover:bg-muted/40 transition-colors">
                <Link href={item.href} className="flex items-center gap-4 px-4 py-2.5">
                  <span
                    className={cn(
                      "w-10 shrink-0 text-right text-lg font-semibold tabular-nums",
                      COUNT_TONES[item.tone]
                    )}
                  >
                    {item.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground truncate text-xs">{item.description}</p>
                  </div>
                  <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 items-center justify-center border-t px-6 py-8">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              icon={CheckCircle2}
              className="border-0 py-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
