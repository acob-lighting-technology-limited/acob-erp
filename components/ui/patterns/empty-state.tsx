import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("border-border bg-background rounded-lg border p-6 text-center sm:p-10", className)}>
      {Icon ? <Icon className="text-muted-foreground mx-auto mb-3 h-9 w-9" /> : null}
      <h3 className="text-foreground text-base font-semibold sm:text-lg">{title}</h3>
      {description ? <p className="text-muted-foreground mx-auto mt-1 max-w-xl text-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
