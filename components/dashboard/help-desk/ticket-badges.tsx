"use client"

import { Badge } from "@/components/ui/badge"
import { TONE_CLASSES } from "@/lib/ui/status-tones"

const PRIORITY_STYLES: Record<string, string> = {
  low: TONE_CLASSES.neutral,
  medium: TONE_CLASSES.info,
  high: TONE_CLASSES.warning,
  urgent: TONE_CLASSES.danger,
}

const STATUS_STYLES: Record<string, string> = {
  new: TONE_CLASSES.neutral,
  pending_lead_review: TONE_CLASSES.purple,
  department_queue: TONE_CLASSES.info,
  department_assigned: TONE_CLASSES.info,
  assigned: TONE_CLASSES.info,
  in_progress: TONE_CLASSES.info,
  pending_approval: TONE_CLASSES.warning,
  approved_for_procurement: TONE_CLASSES.success,
  rejected: TONE_CLASSES.danger,
  returned: TONE_CLASSES.warning,
  resolved: TONE_CLASSES.success,
  closed: TONE_CLASSES.success,
  cancelled: TONE_CLASSES.neutral,
}

function formatLabel(value: string | null | undefined) {
  return String(value || "unknown").replaceAll("_", " ")
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const key = String(priority || "").toLowerCase()
  const tone = PRIORITY_STYLES[key] || TONE_CLASSES.neutral
  return <Badge className={tone}>{formatLabel(priority)}</Badge>
}

export function TicketStatusBadge({ status }: { status: string | null | undefined }) {
  const key = String(status || "").toLowerCase()
  const tone = STATUS_STYLES[key] || TONE_CLASSES.neutral
  return <Badge className={tone}>{formatLabel(status)}</Badge>
}
