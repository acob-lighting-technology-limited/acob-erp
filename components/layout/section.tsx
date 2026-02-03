import { cn } from "@/lib/utils"

interface SectionProps {
  /** Section title */
  title?: string
  /** Optional description */
  description?: string
  /** Section content */
  children: React.ReactNode
  /** Additional classes */
  className?: string
}

/**
 * Section component for grouping related content with optional title.
 *
 * @example
 * <Section title="Quick Actions">
 *   {cards}
 * </Section>
 */
export function Section({ title, description, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h2 className="text-foreground text-base font-semibold md:text-lg">{title}</h2>}
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      )}
      {children}
    </section>
  )
}
