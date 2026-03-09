import { cn } from "@/lib/utils"

interface ListToolbarProps {
  search?: React.ReactNode
  filters?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function ListToolbar({ search, filters, actions, className }: ListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {search}
        {filters}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
