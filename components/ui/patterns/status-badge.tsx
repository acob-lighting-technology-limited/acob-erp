import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Tones come from the `--success/--warning/--danger/--info` tokens in
 * `app/globals.css`, which carry their own dark values: no `dark:` overrides here.
 */
export const TONE_CLASSES = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  purple: "bg-purple/15 text-purple",
  neutral: "bg-muted text-muted-foreground",
} as const

export type StatusTone = keyof typeof TONE_CLASSES

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
  paid: "success",
  unpaid: "danger",
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
  // Document validity (Sites register conveyance documents).
  valid: "success",
  expiring: "warning",
  expired: "danger",
  not_required: "neutral",
}

interface StatusBadgeProps {
  status: string
  /** Text to show instead of the status itself; the status still picks the colour. */
  label?: string
  /** Force a tone for a status this map does not know. */
  tone?: StatusTone
  className?: string
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const key = String(status || "").toLowerCase()
  const resolved = tone ?? STATUS_TONES[key] ?? "neutral"
  const text = label ?? (key.replaceAll("_", " ") || "unknown")
  return <Badge className={cn(TONE_CLASSES[resolved], className)}>{text}</Badge>
}
