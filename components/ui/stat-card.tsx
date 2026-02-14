import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type Variant = "default" | "compact" | "large"

interface Trend {
  value: number
  label?: string
}

interface StatCardProps {
  /** Stat title/label */
  title: string
  /** The stat value to display */
  value: string | number
  /** Optional icon */
  icon?: LucideIcon
  /** Tailwind color class for the icon background */
  iconBgColor?: string
  /** Tailwind color class for the icon itself */
  iconColor?: string
  /** Optional trend indicator */
  trend?: Trend
  /** Card size variant */
  variant?: Variant
  /** Additional description text */
  description?: string
  /** Additional classes */
  className?: string
}

/**
 * StatCard component for displaying statistics in a consistent format.
 *
 * @example
 * // Basic usage
 * <StatCard title="Total employee" value={120} icon={Users} />
 *
 * @example
 * // With custom colors
 * <StatCard
 *   title="Active Tasks"
 *   value={45}
 *   icon={ClipboardList}
 *   iconBgColor="bg-green-100 dark:bg-green-900/30"
 *   iconColor="text-green-600 dark:text-green-400"
 * />
 *
 * @example
 * // Compact variant for dense layouts
 * <StatCard title="Assets" value={89} variant="compact" />
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor = "bg-primary/10",
  iconColor = "text-primary",
  trend,
  variant = "default",
  description,
  className,
}: StatCardProps) {
  if (variant === "compact") {
    return (
      <Card className={cn("border", className)}>
        <CardContent className="p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-[10px] font-medium">{title}</p>
              <p className="text-foreground mt-0.5 text-lg font-bold">{value}</p>
            </div>
            {Icon && (
              <div className={cn("rounded-lg p-1.5", iconBgColor)}>
                <Icon className={cn("h-3.5 w-3.5", iconColor)} />
              </div>
            )}
          </div>
          {trend && (
            <p className={cn("mt-1 text-[10px]", trend.value >= 0 ? "text-green-600" : "text-red-600")}>
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (variant === "large") {
    return (
      <Card className={cn("border", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {Icon && (
            <div className={cn("rounded-lg p-2", iconBgColor)}>
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
          {trend && (
            <p className={cn("mt-2 text-sm", trend.value >= 0 ? "text-green-600" : "text-red-600")}>
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Default variant
  return (
    <Card className={cn("border", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && (
          <div className={cn("rounded-lg p-1.5", iconBgColor)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
        {trend && (
          <p className={cn("mt-1 text-xs", trend.value >= 0 ? "text-green-600" : "text-red-600")}>
            {trend.value >= 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
