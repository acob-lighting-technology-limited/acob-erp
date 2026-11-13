import { Badge } from "@/components/ui/badge"
import type { PaymentScheduleStatus, ScheduleItemOutcome } from "@/lib/requisitions/types"
import { cn } from "@/lib/utils"
import { TONE_CLASSES } from "@/lib/ui/status-tones"

export const SCHEDULE_STATUS_LABELS: Record<PaymentScheduleStatus, string> = {
  draft: "Draft",
  sent: "Finalized",
  closed: "Closed",
}

const SCHEDULE_STATUS_CLASS: Record<PaymentScheduleStatus, string> = {
  draft: TONE_CLASSES.warning,
  sent: TONE_CLASSES.info,
  closed: TONE_CLASSES.success,
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
  pending: TONE_CLASSES.warning,
  paid: TONE_CLASSES.success,
  unpaid: TONE_CLASSES.danger,
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
