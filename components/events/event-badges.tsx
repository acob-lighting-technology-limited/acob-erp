import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  EVENT_STATUS_BADGE_CLASSES,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_BADGE_CLASSES,
  EVENT_TYPE_LABELS,
  MD_INVOLVEMENT_LABELS,
  type EventStatus,
  type EventType,
  type MdInvolvement,
} from "@/lib/events/types"

export function EventTypeBadge({ type, className }: { type: EventType; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", EVENT_TYPE_BADGE_CLASSES[type], className)}>
      {EVENT_TYPE_LABELS[type]}
    </Badge>
  )
}

export function EventStatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", EVENT_STATUS_BADGE_CLASSES[status], className)}>
      {EVENT_STATUS_LABELS[status]}
    </Badge>
  )
}

export function MdInvolvementBadge({ value, className }: { value: MdInvolvement; className?: string }) {
  if (value === "none") return null
  return (
    <Badge variant="secondary" className={className}>
      {MD_INVOLVEMENT_LABELS[value]}
    </Badge>
  )
}
