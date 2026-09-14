"use client"

import { Clock, Eye, MapPin, Pencil, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatWATDate, formatWATDateTimeRange } from "@/lib/utils/date"
import {
  EVENT_LOCATION_LABELS,
  EVENT_RSVP_LABELS,
  EVENT_VISIBILITY_LABELS,
  type CalendarEvent,
} from "@/lib/events/types"
import { EventStatusBadge, EventTypeBadge, MdInvolvementBadge } from "./event-badges"

interface EventCardProps {
  event: CalendarEvent
  onSelect: (event: CalendarEvent) => void
  onEdit?: (event: CalendarEvent) => void
}

function whenLabel(e: CalendarEvent) {
  if (!e.all_day) return formatWATDateTimeRange(e.start_at, e.end_at)
  const start = formatWATDate(e.start_at)
  const end = formatWATDate(new Date(new Date(e.end_at).getTime() - 1))
  return start === end ? `${start} · all day` : `${start} – ${end} · all day`
}

function locationLabel(e: CalendarEvent) {
  const place = [e.room_name, e.venue].filter(Boolean).join(" · ")
  return place ? `${EVENT_LOCATION_LABELS[e.location_type]} · ${place}` : EVENT_LOCATION_LABELS[e.location_type]
}

export function EventCard({ event, onSelect, onEdit }: EventCardProps) {
  const goingCount = event.attendees.filter((a) => a.rsvp === "yes").length
  const totalCount = event.attendees.length

  return (
    <Card className="border-border/80 flex flex-col justify-between transition-all duration-200 hover:shadow-md">
      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <EventTypeBadge type={event.type} />
            <EventStatusBadge status={event.status} />
            <MdInvolvementBadge value={event.md_involvement} />
          </div>
          <Badge variant="secondary" className="text-[11px] font-normal">
            {event.visibility === "department" && event.department_name
              ? event.department_name
              : EVENT_VISIBILITY_LABELS[event.visibility]}
          </Badge>
        </div>

        <h4
          className={cn(
            "text-foreground line-clamp-2 pt-1 text-sm leading-snug font-semibold",
            event.status === "cancelled" && "line-through opacity-60"
          )}
        >
          {event.title}
        </h4>
      </CardHeader>

      <CardContent className="space-y-2.5 p-4 pt-1 pb-3 text-xs">
        {/* Time & Date */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock className="text-primary/70 h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground/90 font-medium">{whenLabel(event)}</span>
        </div>

        {/* Location */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MapPin className="text-primary/70 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{locationLabel(event)}</span>
        </div>

        {/* Attendees / RSVP info */}
        <div className="bg-muted/40 border-muted flex items-center justify-between rounded-md border p-2 text-[11px]">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <Users className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
            <span>{totalCount > 0 ? `${goingCount} of ${totalCount} attending` : "Open attendance"}</span>
          </div>
          {event.my_rsvp && (
            <Badge variant="outline" className="text-[10px] capitalize">
              Your reply: {EVENT_RSVP_LABELS[event.my_rsvp]}
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-border/40 mt-auto flex items-center justify-between border-t p-4 pt-2.5">
        <span className="text-muted-foreground max-w-[140px] truncate text-[11px]">
          {event.organizer_name ? `By ${event.organizer_name}` : "ACOB Calendar"}
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSelect(event)}>
            <Eye className="mr-1 h-3 w-3" /> View
          </Button>
          {event.can_manage && onEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEdit(event)}>
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
