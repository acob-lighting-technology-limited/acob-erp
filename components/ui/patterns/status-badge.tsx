import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import type { StatusTone } from "@/lib/ui/status-tones"

const STATUS_TONES: Record<string, StatusTone> = {
  active: "success",
  inactive: "neutral",
  pending: "warning",
  approved: "success",
  open: "info",
  in_progress: "info",
  completed: "success",
  resolved: "success",
  unresolved: "warning",
  cancelled: "neutral",
  rejected: "danger",
  submitted: "success",
  acknowledged: "success",
  draft: "neutral",
  under_review: "warning",
  in_review: "warning",
  returned_for_correction: "warning",
  paid: "success",
  unpaid: "danger",
  overdue: "danger",
  passed: "success",
  failed: "danger",
  verified: "success",
  published: "success",
  archived: "neutral",
  contract: "purple",
  suspended: "warning",
  exited: "danger",
  on_leave: "info",
  ok: "success",
  error: "danger",
  not_started: "warning",
  // Document validity (Sites register conveyance documents).
  valid: "success",
  expiring: "warning",
  expired: "danger",
  not_required: "neutral",
}

/** The tone a status string maps to, or `neutral` for one this map does not know. */
export function statusTone(status: string | null | undefined): StatusTone {
  return STATUS_TONES[String(status || "").toLowerCase()] ?? "neutral"
}

interface StatusBadgeProps {
  status: string
  /** Text to show instead of the status itself; the status still picks the colour. */
  label?: ReactNode
  /** Force a tone for a status this map does not know. */
  tone?: StatusTone
  className?: string
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const key = String(status || "").toLowerCase()
  const resolved = tone ?? statusTone(key)
  const text = label ?? (key.replaceAll("_", " ") || "unknown")
  return (
    <Badge tone={resolved} className={className}>
      {text}
    </Badge>
  )
}
