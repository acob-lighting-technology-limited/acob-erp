import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ElementType<{ className?: string }>
  action?: React.ReactNode
  /** Inside a panel, popover or sheet: no card frame, tighter padding, smaller type. */
  compact?: boolean
  className?: string
}

export function EmptyState({ title, description, icon: Icon, action, compact, className }: EmptyStateProps) {
  if (compact) {
    return (
      <div className={cn("py-6 text-center", className)}>
        {Icon ? <Icon className="text-muted-foreground mx-auto mb-2 h-6 w-6" /> : null}
        <p className="text-muted-foreground text-sm">{title}</p>
        {description ? <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">{description}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    )
  }
  return (
    <div className={cn("border-border bg-background rounded-lg border p-6 text-center sm:p-10", className)}>
      {Icon ? <Icon className="text-muted-foreground mx-auto mb-3 h-9 w-9" /> : null}
      <h3 className="text-foreground text-base font-semibold sm:text-lg">{title}</h3>
      {description ? <p className="text-muted-foreground mx-auto mt-1 max-w-xl text-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
