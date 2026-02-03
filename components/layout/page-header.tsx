import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface BackLink {
  href: string
  label?: string
}

interface PageHeaderProps {
  /** Page title - displayed prominently */
  title: string
  /** Optional description shown below title */
  description?: string
  /** Optional icon displayed next to title */
  icon?: LucideIcon
  /** Back navigation link */
  backLink?: BackLink
  /** Actions (buttons, dropdowns) shown on the right */
  actions?: React.ReactNode
  /** Additional classes for the container */
  className?: string
}

/**
 * PageHeader provides a consistent header layout for all pages.
 * Includes title, optional description, icon, back link, and action buttons.
 *
 * @example
 * // Simple header
 * <PageHeader title="Dashboard" />
 *
 * @example
 * // Header with icon and description
 * <PageHeader
 *   title="Admin Dashboard"
 *   description="Manage your organization"
 *   icon={Shield}
 * />
 *
 * @example
 * // Header with back link and actions
 * <PageHeader
 *   title="Edit Product"
 *   backLink={{ href: "/admin/products", label: "Back to Products" }}
 *   actions={<Button>Save</Button>}
 * />
 */
export function PageHeader({ title, description, icon: Icon, backLink, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        {backLink && (
          <Link
            href={backLink.href}
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLink.label || "Back"}
          </Link>
        )}
        <div className="flex items-center gap-2">
          {Icon && <Icon className="text-primary h-6 w-6 md:h-7 md:w-7" />}
          <h1 className="text-foreground text-2xl font-bold md:text-3xl">{title}</h1>
        </div>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
