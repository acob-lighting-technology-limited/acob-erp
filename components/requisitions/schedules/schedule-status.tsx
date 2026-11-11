import { Badge } from "@/components/ui/badge"
import type { PaymentScheduleStatus, ScheduleItemOutcome } from "@/lib/requisitions/types"
import { cn } from "@/lib/utils"

export const SCHEDULE_STATUS_LABELS: Record<PaymentScheduleStatus, string> = {
  draft: "Draft",
  sent: "Sent to MD",
  closed: "Closed",
}

const SCHEDULE_STATUS_CLASS: Record<PaymentScheduleStatus, string> = {
  draft: "border-warning/30 bg-warning/15 text-warning",
  sent: "border-info/30 bg-info/15 text-info",
  closed: "border-success/30 bg-success/15 text-success",
}

export function ScheduleStatusBadge({ status, className }: { status: PaymentScheduleStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(SCHEDULE_STATUS_CLASS[status], "text-xs", className)}>
      {SCHEDULE_STATUS_LABELS[status]}
    </Badge>
  )
}

const OUTCOME_LABELS: Record<ScheduleItemOutcome, string> = {
  pending: "Waiting for the bank",
  paid: "Paid",
  unpaid: "Not paid",
}

const OUTCOME_CLASS: Record<ScheduleItemOutcome, string> = {
  pending: "border-warning/30 bg-warning/15 text-warning",
  paid: "border-success/30 bg-success/15 text-success",
  unpaid: "border-danger/30 bg-danger/15 text-danger",
}

export function OutcomeBadge({ outcome }: { outcome: ScheduleItemOutcome }) {
  return (
    <Badge variant="outline" className={cn(OUTCOME_CLASS[outcome], "w-fit text-xs")}>
      {OUTCOME_LABELS[outcome]}
    </Badge>
  )
}

export function todayInLagos() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })
}
