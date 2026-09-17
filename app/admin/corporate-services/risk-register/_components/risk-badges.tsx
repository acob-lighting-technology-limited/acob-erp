import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { RATING_LABELS, STATUS_LABELS, type RiskRating, type RiskStatus } from "@/lib/risk-register/model"

export const RATING_STYLES: Record<RiskRating, string> = {
  green: "border-emerald-300 bg-emerald-500/15 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300",
  yellow: "border-amber-300 bg-amber-400/20 text-amber-900 dark:border-amber-700 dark:text-amber-200",
  red: "border-rose-300 bg-rose-500/15 text-rose-800 dark:border-rose-800 dark:text-rose-300",
}

const STATUS_STYLES: Record<RiskStatus, string> = {
  open: "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300",
  in_progress: "border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300",
  closed: "border-muted-foreground/20 text-muted-foreground",
}

export function RatingBadge({ rating, score, className }: { rating: RiskRating; score?: number; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-semibold whitespace-nowrap", RATING_STYLES[rating], className)}>
      {RATING_LABELS[rating]}
      {score !== undefined && <span className="ml-1 font-normal opacity-80">· {score}</span>}
    </Badge>
  )
}

export function StatusBadge({ status, className }: { status: RiskStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
