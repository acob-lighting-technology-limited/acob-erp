"use client"

import { Badge } from "@/components/ui/badge"

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/15 text-info border-info/30",
  high: "bg-warning/15 text-warning border-warning/30",
  urgent: "bg-danger/15 text-danger border-danger/30",
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-muted text-muted-foreground border-border",
  pending_lead_review: "bg-purple/15 text-purple border-purple/30",
  department_queue: "bg-info/15 text-info border-info/30",
  department_assigned: "bg-info/15 text-info border-info/30",
  assigned: "bg-info/15 text-info border-info/30",
  in_progress: "bg-info/15 text-info border-info/30",
  pending_approval: "bg-warning/15 text-warning border-warning/30",
  approved_for_procurement: "bg-success/15 text-success border-success/30",
  rejected: "bg-danger/15 text-danger border-danger/30",
  returned: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-success/15 text-success border-success/30",
  closed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-muted text-muted-foreground border-border",
}

function formatLabel(value: string | null | undefined) {
  return String(value || "unknown").replaceAll("_", " ")
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const key = String(priority || "").toLowerCase()
  const tone = PRIORITY_STYLES[key] || "bg-muted text-muted-foreground border-border"
  return <Badge className={tone}>{formatLabel(priority)}</Badge>
}

export function TicketStatusBadge({ status }: { status: string | null | undefined }) {
  const key = String(status || "").toLowerCase()
  const tone = STATUS_STYLES[key] || "bg-muted text-muted-foreground border-border"
  return <Badge className={tone}>{formatLabel(status)}</Badge>
}
