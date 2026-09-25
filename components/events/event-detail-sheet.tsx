"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Building2, CalendarClock, Link2, MapPin, Pencil, Trash2, User, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDateTimeRange, formatWATDate } from "@/lib/utils/date"
import {
  EVENT_LOCATION_LABELS,
  EVENT_RSVP_LABELS,
  EVENT_VISIBILITY_LABELS,
  type CalendarEvent,
  type EventRsvp,
} from "@/lib/events/types"
import { EventStatusBadge, EventTypeBadge, MdInvolvementBadge } from "./event-badges"
import { respondToEvent } from "./use-events"

const RSVP_CHOICES: EventRsvp[] = ["yes", "maybe", "no"]

/** Synthetic holiday events have no real row in `events` — detect them by id prefix. */
function isHolidayEvent(event: CalendarEvent): boolean {
  return event.id.startsWith("holiday-")
}

function whenLabel(event: CalendarEvent) {
  if (!event.all_day) return formatWATDateTimeRange(event.start_at, event.end_at)
  const start = formatWATDate(event.start_at)
  // All-day events end at the following midnight; show the last day they cover.
  const end = formatWATDate(new Date(new Date(event.end_at).getTime() - 1))
  return start === end ? `${start} (all day)` : `${start} – ${end} (all day)`
}

export function EventDetailSheet({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (event: CalendarEvent) => void
}) {
  const queryClient = useQueryClient()
  const [savingRsvp, setSavingRsvp] = useState<EventRsvp | null>(null)
  const [localRsvp, setLocalRsvp] = useState<{ id: string; rsvp: EventRsvp } | null>(null)

  if (!event) return null
  const myRsvp = localRsvp?.id === event.id ? localRsvp.rsvp : event.my_rsvp
  const going = event.attendees.filter((a) => a.rsvp === "yes").length

  const respond = async (rsvp: EventRsvp) => {
    setSavingRsvp(rsvp)
    try {
      await respondToEvent(event.id, rsvp)
      setLocalRsvp({ id: event.id, rsvp })
      toast.success(`Response saved: ${EVENT_RSVP_LABELS[rsvp]}`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events() }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingRsvpCount() }),
      ])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save your response")
    } finally {
      setSavingRsvp(null)
    }
  }

  const location = [event.room_name, event.venue].filter(Boolean).join(" · ")
  const isHoliday = isHolidayEvent(event)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-3 border-b pb-4">
          <div className="flex flex-wrap gap-2 pr-8">
            <EventTypeBadge type={event.type} />
            {!isHoliday && <EventStatusBadge status={event.status} />}
            {!isHoliday && <MdInvolvementBadge value={event.md_involvement} />}
          </div>
          <SheetTitle className="text-left text-lg">{event.title}</SheetTitle>
          <SheetDescription className="text-left">{whenLabel(event)}</SheetDescription>
        </SheetHeader>

        {isHoliday ? (
          <div className="flex-1 p-4">
            <p className="text-muted-foreground text-sm">
              Nigerian public holiday — this day is not counted as a working day in leave and attendance.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 p-4">
              <dl className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <div>
                    <dt className="sr-only">Location</dt>
                    <dd>
                      {EVENT_LOCATION_LABELS[event.location_type]}
                      {location ? ` · ${location}` : ""}
                    </dd>
                  </div>
                </div>
                {event.meeting_url && (
                  <div className="flex gap-3">
                    <Link2 className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <dd className="min-w-0">
                      <a
                        href={event.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary break-all underline-offset-4 hover:underline"
                      >
                        Join link
                      </a>
                    </dd>
                  </div>
                )}
                <div className="flex gap-3">
                  <Users className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <dd>{EVENT_VISIBILITY_LABELS[event.visibility]}</dd>
                </div>
                {event.department_name && (
                  <div className="flex gap-3">
                    <Building2 className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <dd>{event.department_name}</dd>
                  </div>
                )}
                {event.organizer_name && (
                  <div className="flex gap-3">
                    <User className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <dd>Organised by {event.organizer_name}</dd>
                  </div>
                )}
              </dl>

              {event.description && (
                <p className="text-muted-foreground text-sm whitespace-pre-line">{event.description}</p>
              )}

              {myRsvp !== null && event.status === "scheduled" && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    You&apos;re invited — will you attend?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RSVP_CHOICES.map((choice) => (
                      <Button
                        key={choice}
                        size="sm"
                        variant={myRsvp === choice ? "default" : "outline"}
                        disabled={savingRsvp !== null}
                        onClick={() => respond(choice)}
                        aria-pressed={myRsvp === choice}
                      >
                        {EVENT_RSVP_LABELS[choice]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {event.attendees.length > 0 && (
                <div className="space-y-2">
                  <Separator />
                  <p className="text-sm font-medium">
                    Invitees{" "}
                    <span className="text-muted-foreground font-normal">
                      ({going} going of {event.attendees.length})
                    </span>
                  </p>
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
                    {event.attendees.map((a) => (
                      <li key={a.profile_id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {a.name}
                          {a.department && <span className="text-muted-foreground"> · {a.department}</span>}
                        </span>
                        <Badge variant={a.rsvp === "yes" ? "default" : "secondary"} className="shrink-0">
                          {EVENT_RSVP_LABELS[a.rsvp]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {event.can_manage && (onEdit || onDelete) && (
              <SheetFooter className="flex-row gap-2 border-t p-4">
                {onDelete && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(event)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                    Delete
                  </Button>
                )}
                {onEdit && (
                  <Button className="flex-1" onClick={() => onEdit(event)}>
                    <Pencil className="mr-1.5 h-4 w-4" aria-hidden />
                    Edit event
                  </Button>
                )}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
