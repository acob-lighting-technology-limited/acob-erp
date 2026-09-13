"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { QUERY_KEYS } from "@/lib/query-keys"
import { toLocalDateTimeInput, toLocalISODate } from "@/lib/utils/date"
import {
  EVENT_LOCATION_LABELS,
  EVENT_LOCATION_TYPES,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EVENT_VISIBILITIES,
  EVENT_VISIBILITY_LABELS,
  MD_INVOLVEMENTS,
  MD_INVOLVEMENT_LABELS,
  type CalendarEvent,
  type EventLocationType,
  type EventOptions,
  type EventStatus,
  type EventType,
  type EventVisibility,
  type MdInvolvement,
} from "@/lib/events/types"
import { saveEvent } from "./use-events"

const NONE = "__none__"
/** WAT is UTC+1 all year (no daylight saving), so local form values carry a fixed offset. */
const WAT_OFFSET = "+01:00"
const DAY_MS = 86_400_000

type FormState = {
  title: string
  type: EventType
  status: EventStatus
  all_day: boolean
  start: string // datetime-local, or date when all_day
  end: string
  location_type: EventLocationType
  room_id: string
  venue: string
  meeting_url: string
  visibility: EventVisibility
  department_id: string
  md_involvement: MdInvolvement
  organizer_id: string
  attendee_ids: string[]
  invite_department_ids: string[]
  description: string
}

function initialState(event: CalendarEvent | null, defaults?: Partial<FormState>): FormState {
  if (event) {
    const endForDate = new Date(new Date(event.end_at).getTime() - DAY_MS)
    return {
      title: event.title,
      type: event.type,
      status: event.status,
      all_day: event.all_day,
      start: event.all_day ? toLocalISODate(new Date(event.start_at)) : toLocalDateTimeInput(new Date(event.start_at)),
      end: event.all_day ? toLocalISODate(endForDate) : toLocalDateTimeInput(new Date(event.end_at)),
      location_type: event.location_type,
      room_id: event.room_id ?? NONE,
      venue: event.venue ?? "",
      meeting_url: event.meeting_url ?? "",
      visibility: event.visibility,
      department_id: event.department_id ?? NONE,
      md_involvement: event.md_involvement,
      organizer_id: event.organizer_id ?? NONE,
      attendee_ids: event.attendees.map((a) => a.profile_id),
      invite_department_ids: [],
      description: event.description ?? "",
    }
  }
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setTime(start.getTime() + 3_600_000)
  return {
    title: "",
    type: "meeting",
    status: "scheduled",
    all_day: false,
    start: toLocalDateTimeInput(start),
    end: toLocalDateTimeInput(new Date(start.getTime() + 3_600_000)),
    location_type: "physical",
    room_id: NONE,
    venue: "",
    meeting_url: "",
    visibility: "company",
    department_id: NONE,
    md_involvement: "none",
    organizer_id: NONE,
    attendee_ids: [],
    invite_department_ids: [],
    description: "",
    ...defaults,
  }
}

function toIsoRange(form: FormState): { start_at: string; end_at: string } | null {
  if (!form.start || !form.end) return null
  if (form.all_day) {
    const start = new Date(`${form.start}T00:00:00${WAT_OFFSET}`)
    // Stored end is exclusive: the midnight after the last day.
    const end = new Date(new Date(`${form.end}T00:00:00${WAT_OFFSET}`).getTime() + DAY_MS)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return { start_at: start.toISOString(), end_at: end.toISOString() }
  }
  const start = new Date(`${form.start}:00${WAT_OFFSET}`)
  const end = new Date(`${form.end}:00${WAT_OFFSET}`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start_at: start.toISOString(), end_at: end.toISOString() }
}

function EventForm({
  event,
  options,
  defaults,
  onDone,
}: {
  event: CalendarEvent | null
  options: EventOptions
  defaults?: Partial<FormState>
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(() => initialState(event, defaults))
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const { capabilities } = options
  const canSetMd = capabilities.isEventManager || capabilities.canEditMdDesk

  const departmentOptions = useMemo(() => {
    const allowed = capabilities.allowedDepartmentIds
    return options.departments.filter((d) => allowed === null || allowed.includes(d.id))
  }, [options.departments, capabilities.allowedDepartmentIds])

  const visibilityOptions = EVENT_VISIBILITIES.filter(
    (v) => v !== "private" || capabilities.canEditMdDesk || form.visibility === "private"
  )
  const staffOptions = useMemo(
    () => options.staff.map((s) => ({ value: s.id, label: s.department ? `${s.name} · ${s.department}` : s.name })),
    [options.staff]
  )
  const roomOptions = useMemo(
    () => [{ value: NONE, label: "No company room" }, ...options.rooms.map((r) => ({ value: r.id, label: r.name }))],
    [options.rooms]
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const range = toIsoRange(form)
    if (!range) {
      toast.error("Enter a valid start and end")
      return
    }
    setSaving(true)
    try {
      const result = await saveEvent(
        {
          type: form.type,
          title: form.title,
          description: form.description,
          ...range,
          all_day: form.all_day,
          location_type: form.location_type,
          room_id: form.room_id === NONE ? null : form.room_id,
          venue: form.venue,
          meeting_url: form.meeting_url,
          visibility: form.visibility,
          department_id: form.department_id === NONE ? null : form.department_id,
          md_involvement: canSetMd ? form.md_involvement : (event?.md_involvement ?? "none"),
          status: form.status,
          organizer_id: form.organizer_id === NONE ? null : form.organizer_id,
          attendee_ids: form.attendee_ids,
          invite_department_ids: form.invite_department_ids,
        },
        event?.id
      )
      if (result.warning) toast.warning(result.warning)
      else toast.success(event ? "Event updated" : "Event created")
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events() })
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input
          id="event-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={200}
          required
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v as EventType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as EventStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {EVENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor="event-all-day" className="cursor-pointer">
          All-day event
        </Label>
        <Switch
          id="event-all-day"
          checked={form.all_day}
          onCheckedChange={(checked) =>
            setForm((f) => ({
              ...f,
              all_day: checked,
              start: checked ? f.start.slice(0, 10) : `${f.start.slice(0, 10)}T09:00`,
              end: checked ? f.end.slice(0, 10) : `${f.end.slice(0, 10)}T10:00`,
            }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-start">{form.all_day ? "First day" : "Starts"}</Label>
          <Input
            id="event-start"
            type={form.all_day ? "date" : "datetime-local"}
            value={form.start}
            onChange={(e) => set("start", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-end">{form.all_day ? "Last day" : "Ends"}</Label>
          <Input
            id="event-end"
            type={form.all_day ? "date" : "datetime-local"}
            value={form.end}
            onChange={(e) => set("end", e.target.value)}
            required
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">Times are West Africa Time (WAT).</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Format</Label>
          <Select value={form.location_type} onValueChange={(v) => set("location_type", v as EventLocationType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_LOCATION_TYPES.map((l) => (
                <SelectItem key={l} value={l}>
                  {EVENT_LOCATION_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.location_type !== "virtual" && (
          <div className="space-y-1.5">
            <Label>Room</Label>
            <SearchableSelect
              value={form.room_id}
              onValueChange={(v) => set("room_id", v || NONE)}
              options={roomOptions}
              placeholder="No company room"
              searchPlaceholder="Search rooms…"
            />
          </div>
        )}
      </div>

      {form.location_type !== "virtual" && (
        <div className="space-y-1.5">
          <Label htmlFor="event-venue">Venue details (optional)</Label>
          <Input
            id="event-venue"
            value={form.venue}
            onChange={(e) => set("venue", e.target.value)}
            placeholder="e.g. Transcorp Hilton, Abuja"
          />
        </div>
      )}

      {form.location_type !== "physical" && (
        <div className="space-y-1.5">
          <Label htmlFor="event-url">Meeting link</Label>
          <Input
            id="event-url"
            type="url"
            value={form.meeting_url}
            onChange={(e) => set("meeting_url", e.target.value)}
            placeholder="https://teams.microsoft.com/…"
            required
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Who can see it</Label>
          <Select
            value={form.visibility}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                visibility: v as EventVisibility,
                md_involvement: v === "private" && f.md_involvement === "none" ? "host" : f.md_involvement,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibilityOptions.map((v) => (
                <SelectItem key={v} value={v}>
                  {EVENT_VISIBILITY_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Department{form.visibility === "department" ? "" : " (optional)"}</Label>
          <Select value={form.department_id} onValueChange={(v) => set("department_id", v)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canSetMd && (
        <div className="space-y-1.5">
          <Label>MD&apos;s schedule</Label>
          <Select value={form.md_involvement} onValueChange={(v) => set("md_involvement", v as MdInvolvement)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MD_INVOLVEMENTS.filter((m) => m !== "none" || form.visibility !== "private").map((m) => (
                <SelectItem key={m} value={m}>
                  {MD_INVOLVEMENT_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.visibility === "private" && (
            <p className="text-muted-foreground text-xs">
              Only the MD, MD&apos;s Desk delegates and invitees see the details. Everyone else sees &ldquo;Busy&rdquo;.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Organiser (optional)</Label>
        <SearchableSelect
          value={form.organizer_id}
          onValueChange={(v) => set("organizer_id", v || NONE)}
          options={[{ value: NONE, label: "No organiser" }, ...staffOptions]}
          placeholder="No organiser"
          searchPlaceholder="Search staff…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Invite departments</Label>
          <SearchableMultiSelect
            label="Departments"
            values={form.invite_department_ids}
            options={options.departments.map((d) => ({ value: d.id, label: d.name }))}
            onChange={(v) => set("invite_department_ids", v)}
            placeholder="Add whole departments…"
            searchPlaceholder="Search departments…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Invite people</Label>
          <SearchableMultiSelect
            label="People"
            values={form.attendee_ids}
            options={staffOptions}
            onChange={(v) => set("attendee_ids", v)}
            placeholder="Add individuals…"
            searchPlaceholder="Search staff…"
          />
        </div>
      </div>
      {form.invite_department_ids.length > 0 && (
        <p className="text-muted-foreground -mt-2 text-xs">
          Everyone currently in the selected departments is invited. People who join later are not added.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="event-description">Description (optional)</Label>
        <Textarea
          id="event-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : event ? "Save changes" : "Create event"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  options,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: CalendarEvent | null
  options: EventOptions | undefined
  defaults?: Partial<FormState>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            Meetings, workshops, webinars and activities appear on the company calendar for everyone allowed to see
            them.
          </DialogDescription>
        </DialogHeader>
        {options ? (
          // Keyed so reopening for a different event starts from fresh state.
          <EventForm
            key={event?.id ?? "new"}
            event={event}
            options={options}
            defaults={defaults}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">Loading form…</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export type EventFormDefaults = Partial<FormState>
