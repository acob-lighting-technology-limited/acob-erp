"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, CalendarOff, Plus, RotateCcw, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { getOfficeWeekFromDate, getOfficeWeekMonday } from "@/lib/meeting-week"
import { toLocalISODate, formatWATDate } from "@/lib/utils/date"

type RotationSettings = {
  departments: string[]
  anchor_week: number
  anchor_year: number
  heads_up_enabled: boolean
  heads_up_time: string
}

type PreviewWeek = {
  week: number
  year: number
  date: string
  department: string | null
  presenter_name: string | null
  source: "roster" | "rotation" | "no_session" | "unconfigured" | "before_start"
}

type SkipRow = { id: string; meeting_week: number; meeting_year: number; reason: string | null }

type RotationPayload = {
  settings: RotationSettings | null
  skips: SkipRow[]
  departmentOptions: string[]
  preview: PreviewWeek[]
}

const EMPTY_SETTINGS: RotationSettings = {
  departments: [],
  anchor_week: 1,
  anchor_year: new Date().getFullYear(),
  heads_up_enabled: false,
  heads_up_time: "12:00",
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

export function KssRotationCard() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<RotationSettings>(EMPTY_SETTINGS)
  const [addDepartment, setAddDepartment] = useState("")
  const [skipDate, setSkipDate] = useState("")
  const [skipReason, setSkipReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.adminKssRotation(),
    queryFn: async (): Promise<RotationPayload> => {
      const res = await apiFetch("/api/admin/communications/kss-rotation", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load rotation")
      return json.data as RotationPayload
    },
  })

  useEffect(() => {
    if (data?.settings) setDraft(data.settings)
  }, [data?.settings])

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
      toast.success("Knowledge Sharing rotation saved")
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
    const res = await apiFetch("/api/admin/communications/kss-rotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_week: week.week, meeting_year: week.year, reason: skipReason || null }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) return toast.error(json?.error || "Failed to mark week")
    toast.success(`Week ${week.week}, ${week.year} marked as no session`)
    setSkipDate("")
    setSkipReason("")
    await refresh()
  }

  const removeSkip = async (id: string) => {
    const res = await apiFetch(`/api/admin/communications/kss-rotation?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!res.ok) return toast.error("Failed to remove week")
    toast.success("Week restored to the rotation")
    await refresh()
  }

  const anchorDateIso = toLocalISODate(getOfficeWeekMonday(draft.anchor_week, draft.anchor_year))
  const addableDepartments = (data?.departmentOptions ?? []).filter((name) => !draft.departments.includes(name))
  const isDirty = JSON.stringify(draft) !== JSON.stringify(data?.settings ?? EMPTY_SETTINGS)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RotateCcw className="h-5 w-5 text-green-600" />
          Knowledge Sharing Rotation
        </CardTitle>
        <CardDescription>
          The Sunday reminder names the presenting department from this order, and a heads-up email goes to next
          week&apos;s department on Monday. A presenter entered in Reports &rsaquo; KSS always takes precedence.
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
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="kss-heads-up-time">Monday heads-up time (WAT)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="kss-heads-up-time"
                    type="time"
                    value={draft.heads_up_time}
                    onChange={(event) => setDraft((prev) => ({ ...prev, heads_up_time: event.target.value }))}
                  />
                  <Switch
                    aria-label="Send Monday heads-up email"
                    checked={draft.heads_up_enabled}
                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, heads_up_enabled: checked }))}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Emails next week&apos;s department, the Admin &amp; HR lead, HCS and MD.
                </p>
              </div>
            </section>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={!isDirty || isSaving}>
                {isSaving ? "Saving…" : "Save rotation"}
              </Button>
            </div>

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
                  <li key={`${row.year}-${row.week}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="text-muted-foreground w-28 shrink-0">{formatWATDate(row.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{describePreview(row)}</span>
                    {row.source === "roster" && <Badge variant="secondary">Roster</Badge>}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
