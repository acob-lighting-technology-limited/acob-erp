import { formatWATDate } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import { isRiskOverdue, type RiskRow } from "@/lib/risk-register/model"

export function describeTimeline(risk: Pick<RiskRow, "timeline_type" | "target_date" | "timeline_note">): string {
  const when =
    risk.timeline_type === "continuous"
      ? "Continuous"
      : risk.target_date
        ? formatWATDate(`${risk.target_date}T12:00:00`, { day: "numeric", month: "short", year: "numeric" })
        : "No date"
  return risk.timeline_note ? `${when} · ${risk.timeline_note}` : when
}

export function TimelineText({ risk, today, className }: { risk: RiskRow; today: string; className?: string }) {
  const overdue = isRiskOverdue(risk, today)
  return (
    <span className={cn("text-xs", overdue && "font-semibold text-rose-600 dark:text-rose-400", className)}>
      {describeTimeline(risk)}
      {overdue && " · Overdue"}
    </span>
  )
}
