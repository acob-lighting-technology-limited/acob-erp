"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CalendarOff,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Repeat,
  RotateCcw,
  Send,
  Trash2,
  Users,
} from "lucide-react"
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
import { cn } from "@/lib/utils"
import { isSameDepartment } from "@/shared/departments"

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

type SessionRow = {
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
  preview: SessionRow[]
  employeeOptions: Array<{
    id: string
    full_name: string | null
    department: string | null
    is_department_lead: boolean
    lead_departments: string[]
  }>
}

/** The General Weekly Meeting always starts at 8:30 AM. */
const MEETING_TIME = "8:30 AM"
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

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

const tileClass = (active: boolean) =>
  cn(
    "flex min-w-[150px] flex-1 items-center gap-3 rounded-lg border-2 p-4 text-left transition-all",
    active
      ? "border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/30"
      : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
  )

function dateToWeek(dateIso: string): { week: number; year: number } | null {
  const [year, month, day] = dateIso.split("-").map(Number)
  if (!year || !month || !day) return null
  return getOfficeWeekFromDate(new Date(year, month - 1, day))
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {children}
    </div>
  )
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

export function KssWorkspace() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<RotationSettings>(EMPTY_SETTINGS)
  const [selectedKey, setSelectedKey] = useState("")
  const [addDepartment, setAddDepartment] = useState("")
  const [skipDate, setSkipDate] = useState("")
  const [skipReason, setSkipReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.adminKssRotation(),
    queryFn: async (): Promise<RotationPayload> => {
      const res = await apiFetch("/api/admin/communications/kss-rotation", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load Knowledge Sharing")
      return json.data as RotationPayload
    },
  })

  const savedSettings = useMemo(() => ({ ...EMPTY_SETTINGS, ...(data?.settings ?? {}) }), [data?.settings])
  useEffect(() => {
    if (data?.settings) setDraft(savedSettings)
  }, [data?.settings, savedSettings])

  const sessions = useMemo(() => {
    const today = toLocalISODate(new Date())
    return (data?.preview ?? []).filter((row) => row.date >= today)
  }, [data?.preview])

  // Default to the next session that has a department.
  useEffect(() => {
    if (selectedKey) return
    const next = sessions.find((row) => row.department)
    if (next) setSelectedKey(`${next.year}-${next.week}`)
  }, [sessions, selectedKey])

  const selected = sessions.find((row) => `${row.year}-${row.week}` === selectedKey) ?? null
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedSettings)
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKssRotation() })

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
      toast.success("Changes saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const moveDepartment = (index: number, delta: number) =>
    setDraft((prev) => {
      const next = [...prev.departments]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, departments: next }
    })

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

  const send = async () => {
    if (!selected) return
    setIsSending(true)
    try {
      await postAction({ action: "send", meeting_week: selected.week, meeting_year: selected.year })
      toast.success("Heads-up is sending")
      setConfirmOpen(false)
      // The send runs in the background; refresh shortly so the status updates.
      setTimeout(() => void refresh(), 8000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>
  if (error || !data) {
    return <p className="text-destructive text-sm">{(error as Error | null)?.message || "Failed to load"}</p>
  }

  const employeeSelectOptions = data.employeeOptions.map((employee) => ({
    value: employee.id,
    label: `${employee.full_name || "Unnamed"}${employee.department ? ` (${employee.department})` : ""}`,
  }))
  const addableDepartments = data.departmentOptions.filter((name) => !draft.departments.includes(name))
  const sent = selected?.heads_up?.outcome === "sent" ? selected.heads_up : null

  // Recomputed from the unsaved draft so the summary follows every change;
  // mirrors send-kss-heads-up (department members and its leads, plus extras).
  const recipients = selected?.department
    ? data.employeeOptions
        .filter((employee) => {
          const department = selected.department as string
          const inDepartment =
            isSameDepartment(employee.department, department) ||
            (employee.is_department_lead &&
              employee.lead_departments.some((managed) => isSameDepartment(managed, department)))
          return draft.extra_recipient_ids.includes(employee.id) || (draft.include_department_members && inDepartment)
        })
        .map((employee) => employee.full_name || "Unnamed")
    : []

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
      {/* ── LEFT: Settings ────────────────────────────────────────────── */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
              Session
            </CardTitle>
            <CardDescription>Choose the session to send the heads-up for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {sessions.map((row) => {
                const key = `${row.year}-${row.week}`
                const isNoSession = !row.department
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isNoSession}
                    onClick={() => setSelectedKey(key)}
                    className={cn(tileClass(selectedKey === key), isNoSession && "cursor-not-allowed opacity-60")}
                  >
                    <Calendar
                      className={cn(
                        "h-5 w-5 shrink-0",
                        selectedKey === key ? "text-orange-600" : "text-muted-foreground"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate font-semibold",
                          selectedKey === key && "text-orange-700 dark:text-orange-400"
                        )}
                      >
                        {row.department ?? "No session"}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {formatWATDate(row.date)}
                        {row.presenter_name ? ` · ${row.presenter_name}` : ""}
                      </div>
                    </div>
                    {row.heads_up?.outcome === "sent" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-purple-600" />
              Recipients
            </CardTitle>
            <CardDescription>Choose who receives the heads-up</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/30 flex items-center justify-between gap-3 rounded-lg p-4">
              <div>
                <div className="font-semibold">Presenting department</div>
                <div className="text-muted-foreground text-xs">Everyone active in that week&apos;s department</div>
              </div>
              <Switch
                aria-label="Include the presenting department"
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
              searchPlaceholder="Search by name or department..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-orange-600" />
              Delivery Timing
            </CardTitle>
            <CardDescription>Send it yourself, or automatically every week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, heads_up_enabled: false }))}
                className={tileClass(!draft.heads_up_enabled)}
              >
                <Send
                  className={cn("h-5 w-5", !draft.heads_up_enabled ? "text-orange-600" : "text-muted-foreground")}
                />
                <div>
                  <div
                    className={cn("font-semibold", !draft.heads_up_enabled && "text-orange-700 dark:text-orange-400")}
                  >
                    Manual
                  </div>
                  <div className="text-muted-foreground text-xs">Only when you press Send</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, heads_up_enabled: true }))}
                className={tileClass(draft.heads_up_enabled)}
              >
                <Repeat
                  className={cn("h-5 w-5", draft.heads_up_enabled ? "text-orange-600" : "text-muted-foreground")}
                />
                <div>
                  <div
                    className={cn("font-semibold", draft.heads_up_enabled && "text-orange-700 dark:text-orange-400")}
                  >
                    Automatic
                  </div>
                  <div className="text-muted-foreground text-xs">Every week, for the next session</div>
                </div>
              </button>
            </div>
            {draft.heads_up_enabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select
                    value={String(draft.heads_up_day)}
                    onValueChange={(value) => setDraft((prev) => ({ ...prev, heads_up_day: Number(value) }))}
                  >
                    <SelectTrigger>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kss-time">Time (WAT)</Label>
                  <Input
                    id="kss-time"
                    type="time"
                    value={draft.heads_up_time}
                    onChange={(event) => setDraft((prev) => ({ ...prev, heads_up_time: event.target.value }))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RotateCcw className="h-5 w-5 text-green-600" />
              Rotation
            </CardTitle>
            <CardDescription>The order departments present in, and weeks with no session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="divide-y rounded-md border">
              {draft.departments.map((department, index) => (
                <div key={department} className="flex items-center gap-1 py-1 pr-1 pl-3 text-sm">
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
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Add department</Label>
                <div className="flex gap-2">
                  <Select value={addDepartment} onValueChange={setAddDepartment}>
                    <SelectTrigger disabled={addableDepartments.length === 0}>
                      <SelectValue placeholder="Select department" />
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="kss-anchor">First department presents on</Label>
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

            <div className="space-y-3 border-t pt-4">
              <Label className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4" /> No session
              </Label>
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
              {data.skips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.skips.map((skip) => (
                    <Badge key={skip.id} variant="secondary" className="gap-1 pr-1">
                      {formatWATDate(toLocalISODate(getOfficeWeekMonday(skip.meeting_week, skip.meeting_year)))}
                      {skip.reason ? ` · ${skip.reason}` : ""}
                      <button
                        type="button"
                        aria-label="Restore week"
                        className="hover:text-destructive ml-1 rounded p-0.5"
                        onClick={() => removeSkip(skip.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── RIGHT: Summary & Send ─────────────────────────────────────── */}
      <aside className="space-y-6 lg:sticky lg:top-[120px] lg:max-h-[calc(100vh-136px)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <SummaryRow label="Date">
                <Badge className="max-w-[72%] truncate">{selected ? formatWATDate(selected.date) : "Not set"}</Badge>
              </SummaryRow>
              <SummaryRow label="Time">
                <Badge variant="secondary">{MEETING_TIME}</Badge>
              </SummaryRow>
              <SummaryRow label="Department">
                <Badge variant="outline" className="max-w-[68%] truncate">
                  {selected?.department ?? "Not set"}
                </Badge>
              </SummaryRow>
              {selected?.presenter_name && (
                <SummaryRow label="Presenter">
                  <Badge variant="outline" className="max-w-[68%] truncate">
                    {selected.presenter_name}
                  </Badge>
                </SummaryRow>
              )}
              <SummaryRow label="Heads-up">
                <Badge variant={sent ? "outline" : "secondary"} className="max-w-[68%] truncate">
                  {sent?.sent_at ? `Sent ${formatWATDateTime(sent.sent_at)}` : "Not sent"}
                </Badge>
              </SummaryRow>
            </div>

            <div className="border-t" />

            <div className="space-y-1">
              <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Recipients</div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-600" />
                <span className="text-2xl font-bold">{recipients.length}</span>
                <span className="text-muted-foreground text-sm">people</span>
              </div>
              {recipients.length > 0 && (
                <div className="mt-2 max-h-[160px] space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">
                  {recipients.map((name, index) => (
                    <div key={`${name}-${index}`} className="truncate">
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t" />

            <div className="space-y-1">
              <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Delivery</div>
              <div className="flex items-center gap-2 text-sm">
                {draft.heads_up_enabled ? (
                  <>
                    <Repeat className="h-4 w-4 text-orange-600" />
                    <span>
                      Every {WEEKDAYS[draft.heads_up_day - 1]} at {draft.heads_up_time}
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 text-orange-600" />
                    <span>Manual only</span>
                  </>
                )}
              </div>
            </div>

            {isDirty && (
              <Button variant="outline" className="w-full" disabled={isSaving} onClick={saveSettings}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            )}

            <Button
              className="w-full bg-orange-600 text-white hover:bg-orange-700"
              size="lg"
              disabled={!selected || recipients.length === 0 || isSending || isDirty}
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Heads-up
            </Button>

            {isDirty ? (
              <p className="text-center text-xs text-amber-600">
                <AlertCircle className="mr-1 inline h-3 w-3" />
                Save changes before sending
              </p>
            ) : (
              selected &&
              recipients.length === 0 && (
                <p className="text-destructive text-center text-xs">
                  <AlertCircle className="mr-1 inline h-3 w-3" />
                  No recipients selected
                </p>
              )
            )}
          </CardContent>
        </Card>
      </aside>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send the heads-up?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected
                ? `${selected.department}, ${formatWATDate(selected.date)}. ${recipients.length} people will be emailed.${sent ? " It was already sent once for this session." : ""}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <Button
              className="bg-orange-600 text-white hover:bg-orange-700"
              loading={isSending}
              onClick={() => void send()}
            >
              Send
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
