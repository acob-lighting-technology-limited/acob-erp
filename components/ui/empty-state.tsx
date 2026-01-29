import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: LucideIcon
}

interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon
  /** Title text */
  title: string
  /** Description text */
  description?: string
  /** Primary action button */
  action?: EmptyStateAction
  /** Additional classes */
  className?: string
}

/**
 * EmptyState component for displaying when no data is available.
 *
 * @example
 * <EmptyState
 *   icon={Package}
 *   title="No products yet"
 *   description="Add your first product to get started."
 *   action={{ label: "Add Product", href: "/products/new", icon: Plus }}
 * />
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {Icon && <Icon className="text-muted-foreground mb-4 h-12 w-12" />}
      <h3 className="text-foreground text-lg font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-1 mb-4 max-w-sm text-sm">{description}</p>}
      {action && (
        <>
          {action.href ? (
            <Link href={action.href}>
              <Button>
                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button onClick={action.onClick}>
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
