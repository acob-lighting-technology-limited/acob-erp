"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, CalendarOff, Mail, Plus, RotateCcw, Send, Trash2, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { getOfficeWeekFromDate, getOfficeWeekMonday } from "@/lib/meeting-week"
import { toLocalISODate, formatWATDate, formatWATDateTime } from "@/lib/utils/date"

type RotationSettings = {
  departments: string[]
  anchor_week: number
  anchor_year: number
  heads_up_enabled: boolean
  heads_up_time: string
  heads_up_day: number
  include_department_members: boolean
  extra_recipient_ids: string[]
}

type PreviewWeek = {
  week: number
  year: number
  date: string
  department: string | null
  presenter_name: string | null
  source: "roster" | "rotation" | "no_session" | "unconfigured" | "before_start"
  recipients: string[]
  heads_up: { sent_at: string | null; recipient_count: number | null; outcome: string | null } | null
}

type SkipRow = { id: string; meeting_week: number; meeting_year: number; reason: string | null }

type RotationPayload = {
  settings: Partial<RotationSettings> | null
  skips: SkipRow[]
  departmentOptions: string[]
  preview: PreviewWeek[]
  employeeOptions: Array<{ id: string; full_name: string | null; department: string | null }>
}

const EMPTY_SETTINGS: RotationSettings = {
  departments: [],
  anchor_week: 1,
  anchor_year: new Date().getFullYear(),
  heads_up_enabled: false,
  heads_up_time: "12:00",
  heads_up_day: 1,
  include_department_members: true,
  extra_recipient_ids: [],
}

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
]

function withDefaults(settings: Partial<RotationSettings> | null | undefined): RotationSettings {
  return { ...EMPTY_SETTINGS, ...(settings ?? {}) }
}

function dateToWeek(dateIso: string): { week: number; year: number } | null {
  const [year, month, day] = dateIso.split("-").map(Number)
  if (!year || !month || !day) return null
  return getOfficeWeekFromDate(new Date(year, month - 1, day))
}

function describePreview(row: PreviewWeek): string {
  if (row.source === "no_session") return "No session"
  if (row.source === "unconfigured") return "Rotation not set up"
  if (row.source === "before_start") return "Before rotation start"
  const name = row.presenter_name ? ` — ${row.presenter_name}` : ""
  return `${row.department ?? "—"}${name}`
}

function describeHeadsUp(row: PreviewWeek): string | null {
  const status = row.heads_up
  if (!status) return null
  if (status.outcome === "sent" && status.sent_at) {
    return `Heads-up sent ${formatWATDateTime(status.sent_at)} to ${status.recipient_count ?? 0}`
  }
  if (status.outcome === "held_for_preview") return "Heads-up held — not sent"
  if (status.outcome === "attempted") return "Heads-up sending…"
  return null
}

async function postAction(body: Record<string, unknown>) {
  const res = await apiFetch("/api/admin/communications/kss-rotation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || "Request failed")
}

export function KssRotationCard() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<RotationSettings>(EMPTY_SETTINGS)
  const [addDepartment, setAddDepartment] = useState("")
  const [skipDate, setSkipDate] = useState("")
  const [skipReason, setSkipReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [sendWeekKey, setSendWeekKey] = useState("")
  const [previewEmail, setPreviewEmail] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.adminKssRotation(),
    queryFn: async (): Promise<RotationPayload> => {
      const res = await apiFetch("/api/admin/communications/kss-rotation", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load rotation")
      return json.data as RotationPayload
    },
  })

  const savedSettings = useMemo(() => withDefaults(data?.settings), [data?.settings])

  useEffect(() => {
    if (data?.settings) setDraft(savedSettings)
  }, [data?.settings, savedSettings])

  const sendableWeeks = useMemo(() => (data?.preview ?? []).filter((row) => Boolean(row.department)), [data?.preview])

  // Default the send target to the next session after today.
  useEffect(() => {
    if (sendWeekKey || sendableWeeks.length === 0) return
    const today = toLocalISODate(new Date())
    const next = sendableWeeks.find((row) => row.date > today) ?? sendableWeeks[0]
    setSendWeekKey(`${next.year}-${next.week}`)
  }, [sendableWeeks, sendWeekKey])

  const sendTarget = sendableWeeks.find((row) => `${row.year}-${row.week}` === sendWeekKey) ?? null

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKssRotation() })

  const moveDepartment = (index: number, delta: number) => {
    setDraft((prev) => {
      const next = [...prev.departments]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, departments: next }
    })
  }

  const removeDepartment = (index: number) =>
    setDraft((prev) => ({ ...prev, departments: prev.departments.filter((_, i) => i !== index) }))

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const res = await apiFetch("/api/admin/communications/kss-rotation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to save")
      toast.success("Knowledge Sharing settings saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const addSkip = async () => {
    const week = dateToWeek(skipDate)
    if (!week) return toast.error("Pick the meeting date to mark")
    try {
      await postAction({ action: "skip", meeting_week: week.week, meeting_year: week.year, reason: skipReason || null })
      toast.success(`Week ${week.week}, ${week.year} marked as no session`)
      setSkipDate("")
      setSkipReason("")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark week")
    }
  }

  const removeSkip = async (id: string) => {
    const res = await apiFetch(`/api/admin/communications/kss-rotation?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!res.ok) return toast.error("Failed to remove week")
    toast.success("Week restored to the rotation")
    await refresh()
  }

  const sendHeadsUp = async (mode: "preview" | "send") => {
    if (!sendTarget) return
    setIsSending(true)
    try {
      await postAction({
        action: mode,
        meeting_week: sendTarget.week,
        meeting_year: sendTarget.year,
        ...(mode === "preview" ? { email: previewEmail } : {}),
      })
      toast.success(mode === "preview" ? `Preview sent to ${previewEmail}` : "Heads-up is sending")
      setConfirmOpen(false)
      // The send runs in the background; refresh shortly so the status updates.
      setTimeout(() => void refresh(), 8000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setIsSending(false)
    }
  }

  const anchorDateIso = toLocalISODate(getOfficeWeekMonday(draft.anchor_week, draft.anchor_year))
  const addableDepartments = (data?.departmentOptions ?? []).filter((name) => !draft.departments.includes(name))
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedSettings)
  const employeeSelectOptions = (data?.employeeOptions ?? []).map((employee) => ({
    value: employee.id,
    label: `${employee.full_name || "Unnamed"}${employee.department ? ` (${employee.department})` : ""}`,
  }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RotateCcw className="h-5 w-5 text-green-600" />
          Knowledge Sharing Rotation
        </CardTitle>
        <CardDescription>
          The Sunday reminder names the presenting department from this order, and a heads-up email tells the department
          ahead of its session. A presenter entered in Reports &rsaquo; KSS always takes precedence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <p className="text-muted-foreground text-sm">Loading rotation…</p>}
        {error && <p className="text-destructive text-sm">{(error as Error).message}</p>}

        {data && (
          <>
            <section className="space-y-3">
              <Label>Department order</Label>
              <ol className="space-y-2">
                {draft.departments.map((department, index) => (
                  <li key={department} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="text-muted-foreground w-6 tabular-nums">{index + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{department}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${department} up`}
                      disabled={index === 0}
                      onClick={() => moveDepartment(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${department} down`}
                      disabled={index === draft.departments.length - 1}
                      onClick={() => moveDepartment(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${department}`}
                      onClick={() => removeDepartment(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ol>
              {addableDepartments.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={addDepartment} onValueChange={setAddDepartment}>
                    <SelectTrigger className="sm:flex-1">
                      <SelectValue placeholder="Add a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {addableDepartments.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!addDepartment}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, departments: [...prev.departments, addDepartment] }))
                      setAddDepartment("")
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="space-y-2 sm:max-w-xs">
                <Label htmlFor="kss-anchor">First department presents on</Label>
                <Input
                  id="kss-anchor"
                  type="date"
                  value={anchorDateIso}
                  onChange={(event) => {
                    const week = dateToWeek(event.target.value)
                    if (week) setDraft((prev) => ({ ...prev, anchor_week: week.week, anchor_year: week.year }))
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  Office week {draft.anchor_week}, {draft.anchor_year}
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Heads-up email
                </Label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Send automatically</span>
                  <Switch
                    aria-label="Send the heads-up automatically"
                    checked={draft.heads_up_enabled}
                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, heads_up_enabled: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Send on</Label>
                  <Select
                    value={String(draft.heads_up_day)}
                    onValueChange={(value) => setDraft((prev) => ({ ...prev, heads_up_day: Number(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kss-heads-up-time">At (WAT)</Label>
                  <Input
                    id="kss-heads-up-time"
                    type="time"
                    value={draft.heads_up_time}
                    onChange={(event) => setDraft((prev) => ({ ...prev, heads_up_time: event.target.value }))}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Announces the next session after the send day. Turn automatic sending off to only send manually below.
              </p>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="kss-include-dept" className="font-normal">
                  Email everyone in the presenting department
                </Label>
                <Switch
                  id="kss-include-dept"
                  checked={draft.include_department_members}
                  onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, include_department_members: checked }))}
                />
              </div>
              <SearchableMultiSelect
                label="Also send to"
                icon={<Users className="h-4 w-4" />}
                values={draft.extra_recipient_ids}
                options={employeeSelectOptions}
                onChange={(values) => setDraft((prev) => ({ ...prev, extra_recipient_ids: values }))}
                placeholder="Choose people who always receive it"
                searchPlaceholder="Search staff…"
              />
            </section>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={!isDirty || isSaving}>
                {isSaving ? "Saving…" : "Save settings"}
              </Button>
            </div>

            <section className="space-y-3 rounded-md border p-4">
              <Label className="flex items-center gap-2">
                <Send className="h-4 w-4" /> Send heads-up now
              </Label>
              {isDirty && (
                <p className="text-xs text-amber-600">Save your settings first — sends use the saved recipients.</p>
              )}
              {sendableWeeks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No upcoming session has a department yet.</p>
              ) : (
                <>
                  <Select value={sendWeekKey} onValueChange={setSendWeekKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sendableWeeks.map((row) => (
                        <SelectItem key={`${row.year}-${row.week}`} value={`${row.year}-${row.week}`}>
                          {formatWATDate(row.date)} — {row.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {sendTarget && (
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Recipients ({sendTarget.recipients.length}): </span>
                        {sendTarget.recipients.length > 0
                          ? sendTarget.recipients.join(", ")
                          : "nobody — check settings"}
                      </p>
                      {describeHeadsUp(sendTarget) && (
                        <p className="text-muted-foreground text-xs">{describeHeadsUp(sendTarget)}</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      placeholder="Preview to email"
                      value={previewEmail}
                      onChange={(event) => setPreviewEmail(event.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={!sendTarget || !previewEmail || isSending}
                      onClick={() => void sendHeadsUp("preview")}
                    >
                      Send preview
                    </Button>
                    <Button
                      disabled={!sendTarget || sendTarget.recipients.length === 0 || isSending || isDirty}
                      onClick={() => setConfirmOpen(true)}
                    >
                      Send now
                    </Button>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-3">
              <Label className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4" /> Weeks with no session
              </Label>
              <p className="text-muted-foreground text-xs">
                Marking a week moves every later department back one week, so nobody loses their turn.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="date" value={skipDate} onChange={(event) => setSkipDate(event.target.value)} />
                <Input
                  placeholder="Reason (optional)"
                  value={skipReason}
                  onChange={(event) => setSkipReason(event.target.value)}
                />
                <Button variant="outline" disabled={!skipDate} onClick={addSkip}>
                  Mark
                </Button>
              </div>
              {data.skips.length > 0 && (
                <ul className="space-y-2">
                  {data.skips.map((skip) => (
                    <li key={skip.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <span className="flex-1">
                        Week {skip.meeting_week}, {skip.meeting_year}
                        {skip.reason ? <span className="text-muted-foreground"> — {skip.reason}</span> : null}
                      </span>
                      <Button variant="ghost" size="icon" aria-label="Restore week" onClick={() => removeSkip(skip.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <Label>Upcoming sessions (saved settings)</Label>
              <ul className="divide-y rounded-md border">
                {data.preview.map((row) => (
                  <li key={`${row.year}-${row.week}`} className="flex flex-wrap items-center gap-x-3 px-3 py-2 text-sm">
                    <span className="text-muted-foreground w-28 shrink-0">{formatWATDate(row.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{describePreview(row)}</span>
                    {row.source === "roster" && <Badge variant="secondary">Roster</Badge>}
                    {row.heads_up?.outcome === "sent" && <Badge variant="outline">Heads-up sent</Badge>}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send the heads-up now?</AlertDialogTitle>
            <AlertDialogDescription>
              {sendTarget
                ? `${sendTarget.department} — session on ${formatWATDate(sendTarget.date)}. ${sendTarget.recipients.length} people will be emailed${sendTarget.heads_up?.outcome === "sent" ? ", and it was already sent once for this session" : ""}.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <Button loading={isSending} onClick={() => void sendHeadsUp("send")}>
              Send now
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
