import { cn } from "@/lib/utils"

type MaxWidth = "full" | "content" | "form" | "narrow"
type Background = "gradient" | "plain"
type Padding = "standard" | "compact" | "none"

interface PageWrapperProps {
  children: React.ReactNode
  /** Maximum width of the content area */
  maxWidth?: MaxWidth
  /** Background style - gradient adds subtle depth */
  background?: Background
  /** Padding around the content */
  padding?: Padding
  /** Additional CSS classes */
  className?: string
}

const maxWidthClasses: Record<MaxWidth, string> = {
  full: "max-w-7xl", // 1280px - Full pages, dashboards
  content: "max-w-4xl", // 896px - Content pages
  form: "max-w-2xl", // 672px - Forms, profiles
  narrow: "max-w-lg", // 512px - Narrow forms, modals
}

const backgroundClasses: Record<Background, string> = {
  gradient: "from-background via-background to-muted/20 bg-gradient-to-br",
  plain: "bg-background",
}

const paddingClasses: Record<Padding, string> = {
  standard: "p-4 md:p-6",
  compact: "p-3 md:p-4",
  none: "",
}

/**
 * PageWrapper provides consistent page layout with standardized
 * max-width, background, and padding across the application.
 *
 * @example
 * // Full-width dashboard page with gradient
 * <PageWrapper maxWidth="full" background="gradient">
 *   <PageHeader title="Dashboard" />
 *   {content}
 * </PageWrapper>
 *
 * @example
 * // Form page with narrower width
 * <PageWrapper maxWidth="form" background="plain">
 *   <PageHeader title="Edit Profile" />
 *   {form}
 * </PageWrapper>
 */
export function PageWrapper({
  children,
  maxWidth = "full",
  background = "gradient",
  padding = "standard",
  className,
}: PageWrapperProps) {
  return (
    <div className={cn("min-h-screen", backgroundClasses[background], paddingClasses[padding], className)}>
      <div className={cn("mx-auto space-y-6", maxWidthClasses[maxWidth])}>{children}</div>
    </div>
  )
}
