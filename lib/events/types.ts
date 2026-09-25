import { z } from "zod"

/**
 * Company events calendar — shared types, labels and the write schema.
 *
 * Access rules live in the database (migration 20260913120000_create_events_calendar):
 * RLS decides who sees and edits which event, so API routes read and write with the
 * caller's session client rather than the service role. Keep these labels in sync
 * with the CHECK constraints there.
 */

export const EVENT_TYPES = ["meeting", "workshop", "webinar", "activity", "training", "holiday"] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_VISIBILITIES = ["company", "department", "invitees", "private"] as const
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number]

export const EVENT_LOCATION_TYPES = ["physical", "virtual", "hybrid"] as const
export type EventLocationType = (typeof EVENT_LOCATION_TYPES)[number]

export const MD_INVOLVEMENTS = ["host", "attending", "none"] as const
export type MdInvolvement = (typeof MD_INVOLVEMENTS)[number]

export const EVENT_STATUSES = ["draft", "scheduled", "cancelled", "completed"] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const EVENT_RSVPS = ["pending", "yes", "no", "maybe"] as const
export type EventRsvp = (typeof EVENT_RSVPS)[number]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: "Meeting",
  workshop: "Workshop",
  webinar: "Webinar",
  activity: "Activity",
  training: "Training",
  holiday: "Holiday",
}

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  company: "Whole company",
  department: "Department",
  invitees: "Invitees only",
  private: "Private (MD)",
}

export const EVENT_LOCATION_LABELS: Record<EventLocationType, string> = {
  physical: "In person",
  virtual: "Virtual",
  hybrid: "Hybrid",
}

export const MD_INVOLVEMENT_LABELS: Record<MdInvolvement, string> = {
  host: "MD hosting",
  attending: "MD attending",
  none: "Not on MD schedule",
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  completed: "Completed",
}

export const EVENT_RSVP_LABELS: Record<EventRsvp, string> = {
  pending: "No response",
  yes: "Going",
  no: "Not going",
  maybe: "Maybe",
}

/** Semantic badge colours, one per type — also used for calendar chips. */
export const EVENT_TYPE_BADGE_CLASSES: Record<EventType, string> = {
  meeting: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  workshop: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  webinar: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  activity: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  training: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  holiday: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
}

export const EVENT_STATUS_BADGE_CLASSES: Record<EventStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
}

export type EventAttendee = {
  profile_id: string
  name: string
  department: string | null
  rsvp: EventRsvp
  attended: boolean | null
}

export type CalendarEvent = {
  id: string
  type: EventType
  title: string
  description: string | null
  start_at: string
  end_at: string
  all_day: boolean
  location_type: EventLocationType
  room_id: string | null
  room_name: string | null
  venue: string | null
  meeting_url: string | null
  visibility: EventVisibility
  department_id: string | null
  department_name: string | null
  md_involvement: MdInvolvement
  status: EventStatus
  organizer_id: string | null
  organizer_name: string | null
  created_by: string
  attendees: EventAttendee[]
  /** The caller's own RSVP when they are invited, otherwise null. */
  my_rsvp: EventRsvp | null
  /** Whether the caller may edit this event (resolved by the database). */
  can_manage: boolean
}

/** A private MD event the caller cannot see — times only. */
export type BusyBlock = {
  start_at: string
  end_at: string
  all_day: boolean
}

export type EventsResponse = {
  events: CalendarEvent[]
  busy: BusyBlock[]
}

export type EventCapabilities = {
  canCreate: boolean
  isEventManager: boolean
  canEditMdDesk: boolean
  /** Departments a pure department lead may attach; null means any department. */
  allowedDepartmentIds: string[] | null
}

export type EventOptions = {
  capabilities: EventCapabilities
  rooms: { id: string; name: string; type: string }[]
  departments: { id: string; name: string }[]
  staff: { id: string; name: string; department: string | null; department_id: string | null }[]
}

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))

export const EVENT_RECURRENCE_FREQUENCIES = ["none", "daily", "weekly", "biweekly", "monthly"] as const
export type EventRecurrenceFrequency = (typeof EVENT_RECURRENCE_FREQUENCIES)[number]

export const EventRecurrenceSchema = z.object({
  frequency: z.enum(EVENT_RECURRENCE_FREQUENCIES).default("none"),
  count: z.number().int().min(1).max(52).default(4),
  until: z.string().optional().nullable(),
  skip_holidays: z.boolean().default(true),
})

export type EventRecurrenceInput = z.infer<typeof EventRecurrenceSchema>

export const EventWriteSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: optionalText,
    start_at: z.string().datetime({ offset: true }),
    end_at: z.string().datetime({ offset: true }),
    all_day: z.boolean().default(false),
    location_type: z.enum(EVENT_LOCATION_TYPES).default("physical"),
    room_id: z.string().uuid().optional().nullable(),
    venue: optionalText,
    meeting_url: z
      .string()
      .trim()
      .url("Meeting link must be a valid URL")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    visibility: z.enum(EVENT_VISIBILITIES).default("company"),
    department_id: z.string().uuid().optional().nullable(),
    md_involvement: z.enum(MD_INVOLVEMENTS).default("none"),
    status: z.enum(EVENT_STATUSES).default("scheduled"),
    organizer_id: z.string().uuid().optional().nullable(),
    /** Individual invitees. */
    attendee_ids: z.array(z.string().uuid()).max(500).default([]),
    /** Whole departments, expanded into one attendee row per current member. */
    invite_department_ids: z.array(z.string().uuid()).max(50).default([]),
    /** Optional recurrence options when creating an event series. */
    recurrence: EventRecurrenceSchema.optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (new Date(v.end_at).getTime() <= new Date(v.start_at).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_at"], message: "End must be after start" })
    }
    if (v.visibility === "department" && !v.department_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["department_id"], message: "Pick the department" })
    }
    if (v.visibility === "private" && v.md_involvement === "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["md_involvement"],
        message: "Private events must be on the MD's schedule",
      })
    }
    if (v.location_type !== "physical" && !v.meeting_url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["meeting_url"], message: "Add the meeting link" })
    }
  })

export type EventWriteInput = z.infer<typeof EventWriteSchema>

export const RsvpSchema = z.object({ rsvp: z.enum(EVENT_RSVPS) })

/** Maps Postgres errors raised by the events schema to user-facing messages. */
export function describeEventDbError(error: { code?: string; message?: string } | null | undefined): {
  status: number
  message: string
} {
  const code = error?.code || ""
  const message = error?.message || ""
  if (code === "23P01") return { status: 409, message: "That room is already booked for part of this time." }
  // Our guard triggers raise 42501 with a readable message; RLS denials use 42501 too.
  if (code === "42501") {
    const readable = /only|can only/i.test(message) ? message : "You don't have permission to do that."
    return { status: 403, message: readable }
  }
  if (code === "23514") return { status: 400, message: "Some event details are invalid." }
  return { status: 500, message: "Something went wrong saving the event." }
}
