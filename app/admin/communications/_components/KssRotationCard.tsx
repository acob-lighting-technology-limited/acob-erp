"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Plus, Send, Trash2, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function withDefaults(settings: Partial<RotationSettings> | null | undefined): RotationSettings {
  return { ...EMPTY_SETTINGS, ...(settings ?? {}) }
}

function dateToWeek(dateIso: string): { week: number; year: number } | null {
  const [year, month, day] = dateIso.split("-").map(Number)
  if (!year || !month || !day) return null
  return getOfficeWeekFromDate(new Date(year, month - 1, day))
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
  const [sendTarget, setSendTarget] = useState<PreviewWeek | null>(null)
  const [previewEmail, setPreviewEmail] = useState("")
  const [isSending, setIsSending] = useState(false)

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

  // Past sessions are not actionable, so the list starts from today.
  const upcoming = useMemo(() => {
    const today = toLocalISODate(new Date())
    return (data?.preview ?? []).filter((row) => row.date >= today)
  }, [data?.preview])

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKssRotation() })
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedSettings)

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
      toast.success("Settings saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const moveDepartment = (index: number, delta: number) => {
    setDraft((prev) => {
      const next = [...prev.departments]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, departments: next }
    })
  }

  const addSkip = async () => {
    const week = dateToWeek(skipDate)
    if (!week) return toast.error("Pick the meeting date")
    try {
      await postAction({ action: "skip", meeting_week: week.week, meeting_year: week.year, reason: skipReason || null })
      toast.success("Marked as no session")
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
    if (!res.ok) return toast.error("Failed to restore week")
    toast.success("Week restored")
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
      if (mode === "preview") {
        toast.success(`Preview sent to ${previewEmail}`)
      } else {
        toast.success("Heads-up is sending")
        setSendTarget(null)
        // The send runs in the background; refresh shortly so the status updates.
        setTimeout(() => void refresh(), 8000)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setIsSending(false)
    }
  }

  const employeeSelectOptions = (data?.employeeOptions ?? []).map((employee) => ({
    value: employee.id,
    label: `${employee.full_name || "Unnamed"}${employee.department ? ` (${employee.department})` : ""}`,
  }))
  const addableDepartments = (data?.departmentOptions ?? []).filter((name) => !draft.departments.includes(name))
  const saveBar = (
    <div className="flex items-center justify-end gap-3 pt-2">
      {isDirty && <span className="text-muted-foreground text-xs">Unsaved changes</span>}
      <Button onClick={saveSettings} disabled={!isDirty || isSaving}>
        {isSaving ? "Saving…" : "Save"}
      </Button>
    </div>
  )

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {error && <p className="text-destructive text-sm">{(error as Error).message}</p>}

        {data && (
          <Tabs defaultValue="upcoming">
            <TabsList className="mb-4">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="heads-up">Heads-up email</TabsTrigger>
              <TabsTrigger value="rotation">Rotation</TabsTrigger>
            </TabsList>

            {/* ── Upcoming ───────────────────────────────────────────── */}
            <TabsContent value="upcoming">
              <ul className="divide-y rounded-md border">
                {upcoming.map((row) => {
                  const sent = row.heads_up?.outcome === "sent"
                  return (
                    <li key={`${row.year}-${row.week}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="text-muted-foreground w-24 shrink-0">{formatWATDate(row.date)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {row.department ?? (row.source === "no_session" ? "No session" : "—")}
                        {row.presenter_name && <span className="text-muted-foreground"> · {row.presenter_name}</span>}
                      </span>
                      {sent && <Badge variant="outline">Sent</Badge>}
                      {row.department && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Send heads-up for ${row.department}`}
                          onClick={() => setSendTarget(row)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </TabsContent>

            {/* ── Heads-up email ─────────────────────────────────────── */}
            <TabsContent value="heads-up" className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                <Label htmlFor="kss-auto" className="font-normal">
                  Send automatically
                </Label>
                <Switch
                  id="kss-auto"
                  checked={draft.heads_up_enabled}
                  onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, heads_up_enabled: checked }))}
                />
              </div>

              {draft.heads_up_enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={String(draft.heads_up_day)}
                    onValueChange={(value) => setDraft((prev) => ({ ...prev, heads_up_day: Number(value) }))}
                  >
                    <SelectTrigger aria-label="Send day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((label, index) => (
                        <SelectItem key={label} value={String(index + 1)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Send time (WAT)"
                    type="time"
                    value={draft.heads_up_time}
                    onChange={(event) => setDraft((prev) => ({ ...prev, heads_up_time: event.target.value }))}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                <Label htmlFor="kss-include-dept" className="font-normal">
                  Everyone in the presenting department
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
                placeholder="Also send to"
                searchPlaceholder="Search staff…"
              />
              {saveBar}
            </TabsContent>

            {/* ── Rotation ───────────────────────────────────────────── */}
            <TabsContent value="rotation" className="space-y-5">
              <ul className="divide-y rounded-md border">
                {draft.departments.map((department, index) => (
                  <li key={department} className="flex items-center gap-1 py-1 pr-1 pl-3 text-sm">
                    <span className="text-muted-foreground w-6 tabular-nums">{index + 1}</span>
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
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, departments: prev.departments.filter((_, i) => i !== index) }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="grid gap-3 sm:grid-cols-2">
                {addableDepartments.length > 0 && (
                  <div className="flex gap-2">
                    <Select value={addDepartment} onValueChange={setAddDepartment}>
                      <SelectTrigger aria-label="Add a department">
                        <SelectValue placeholder="Add department" />
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
                      size="icon"
                      aria-label="Add department"
                      disabled={!addDepartment}
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, departments: [...prev.departments, addDepartment] }))
                        setAddDepartment("")
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Label htmlFor="kss-anchor" className="shrink-0 font-normal">
                    Starts
                  </Label>
                  <Input
                    id="kss-anchor"
                    type="date"
                    value={toLocalISODate(getOfficeWeekMonday(draft.anchor_week, draft.anchor_year))}
                    onChange={(event) => {
                      const week = dateToWeek(event.target.value)
                      if (week) setDraft((prev) => ({ ...prev, anchor_week: week.week, anchor_year: week.year }))
                    }}
                  />
                </div>
              </div>
              {saveBar}

              <div className="space-y-2 border-t pt-4">
                <Label>No session</Label>
                <p className="text-muted-foreground text-xs">Later departments move back a week.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="date"
                    aria-label="Meeting date"
                    value={skipDate}
                    onChange={(event) => setSkipDate(event.target.value)}
                  />
                  <Input
                    placeholder="Reason (optional)"
                    value={skipReason}
                    onChange={(event) => setSkipReason(event.target.value)}
                  />
                  <Button variant="outline" disabled={!skipDate} onClick={addSkip}>
                    Mark
                  </Button>
                </div>
                {data.skips.map((skip) => (
                  <div key={skip.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {formatWATDate(toLocalISODate(getOfficeWeekMonday(skip.meeting_week, skip.meeting_year)))}
                      {skip.reason && <span className="text-muted-foreground"> · {skip.reason}</span>}
                    </span>
                    <Button variant="ghost" size="icon" aria-label="Restore week" onClick={() => removeSkip(skip.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <AlertDialog open={sendTarget !== null} onOpenChange={(open) => !open && setSendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sendTarget?.department} · {sendTarget ? formatWATDate(sendTarget.date) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sendTarget && sendTarget.recipients.length > 0
                ? `${sendTarget.recipients.length} recipients: ${sendTarget.recipients.join(", ")}`
                : "Nobody would receive this. Check the heads-up email settings."}
              {sendTarget?.heads_up?.outcome === "sent" && sendTarget.heads_up.sent_at
                ? ` Already sent ${formatWATDateTime(sendTarget.heads_up.sent_at)}.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isDirty && <p className="text-xs text-amber-600">Save your settings first; sends use saved recipients.</p>}
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Preview to email"
              value={previewEmail}
              onChange={(event) => setPreviewEmail(event.target.value)}
            />
            <Button variant="outline" disabled={!previewEmail || isSending} onClick={() => void sendHeadsUp("preview")}>
              Preview
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <Button
              loading={isSending}
              disabled={!sendTarget || sendTarget.recipients.length === 0 || isDirty}
              onClick={() => void sendHeadsUp("send")}
            >
              Send to all
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
