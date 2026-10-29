import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { RATING_LABELS, STATUS_LABELS, type RiskRating, type RiskStatus } from "@/lib/risk-register/model"

export const RATING_STYLES: Record<RiskRating, string> = {
  green: "border-success/30 bg-success/15 text-success",
  yellow: "border-warning/30 bg-warning/20 text-warning",
  red: "border-danger/30 bg-danger/15 text-danger",
}

const STATUS_STYLES: Record<RiskStatus, string> = {
  open: "border-danger/30 text-danger",
  in_progress: "border-info/30 text-info",
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
