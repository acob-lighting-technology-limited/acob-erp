import { cn } from "@/lib/utils"

interface PageSectionProps {
  title?: string
  description?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function PageSection({ title, description, actions, className, children }: PageSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="text-foreground text-base font-semibold sm:text-lg">{title}</h2>}
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
