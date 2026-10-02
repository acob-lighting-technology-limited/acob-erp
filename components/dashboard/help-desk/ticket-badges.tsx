"use client"

import { StatusBadge } from "@/components/ui/patterns"
import type { StatusTone } from "@/lib/status-tones"

const PRIORITY_TONES: Record<string, StatusTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
}

const TICKET_TONES: Record<string, StatusTone> = {
  new: "neutral",
  closed: "neutral",
  returned: "warning",
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  return <StatusBadge status={priority} tones={PRIORITY_TONES} />
}

export function TicketStatusBadge({ status }: { status: string | null | undefined }) {
  return <StatusBadge status={status} tones={TICKET_TONES} />
}
