import type { EventWriteInput } from "@/lib/events/types"

/** The events table columns a create or edit may set. created_by is never client-supplied. */
export function eventRowFromInput(input: EventWriteInput) {
  const isPhysical = input.location_type === "physical"
  const isVirtual = input.location_type === "virtual"
  return {
    type: input.type,
    title: input.title,
    description: input.description,
    start_at: input.start_at,
    end_at: input.end_at,
    all_day: input.all_day,
    location_type: input.location_type,
    // A virtual event holds no room; a physical one has no link.
    room_id: isVirtual ? null : (input.room_id ?? null),
    venue: isVirtual ? null : input.venue,
    meeting_url: isPhysical ? null : (input.meeting_url ?? null),
    visibility: input.visibility,
    department_id: input.department_id ?? null,
    md_involvement: input.md_involvement,
    status: input.status,
    organizer_id: input.organizer_id ?? null,
  }
}

/**
 * Audit trail values. A private MD event records only its shape — the audit log
 * is readable by admins, who are deliberately not allowed its details.
 */
export function auditEventValues(
  input: Pick<EventWriteInput, "type" | "title" | "start_at" | "end_at" | "visibility" | "status" | "md_involvement">
) {
  const base = {
    type: input.type,
    start_at: input.start_at,
    end_at: input.end_at,
    visibility: input.visibility,
    status: input.status,
    md_involvement: input.md_involvement,
  }
  return input.visibility === "private" ? base : { ...base, title: input.title }
}

export function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)))
}
