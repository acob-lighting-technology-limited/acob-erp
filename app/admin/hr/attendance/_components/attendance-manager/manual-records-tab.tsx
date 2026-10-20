"use client"

/** Manual records / out-of-station tab of the attendance manager. Split from attendance-manager-dialog.tsx (audit 6.1). */

import { useCallback, useState, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { toLocalISODate } from "@/lib/hr/attendance-utils"
import { apiFetch, apiJson } from "@/lib/api-client"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

import {
  log,
  AttendanceReport,
  formatDay,
  formatRangeLabel,
  ManualRecord,
  EntryGroup,
  groupRecords,
  EntriesPanel,
  EntryRow,
  ConfirmDialog,
  EmployeeCheckList,
} from "./shared"

// ────────────────────────────────────────────────────────────
// Tab: Manual day-records (OOS / Waiver)
// ────────────────────────────────────────────────────────────

export interface OpenOosPeriod {
  id: string
  user_id: string
  user_name: string
  start_date: string
  reason: string | null
}

export function ManualRecordsTab({
  reports,
  onDone,
  status,
  intro,
  applyLabel,
  sendWaiverReason,
  placeholder,
  badge,
  oosModes,
}: {
  reports: AttendanceReport[]
  onDone: () => void
  status:
    | "out_of_station"
    | "waiver"
    | "lateness_with_permission"
    | "incomplete_with_permission"
    | "absent_with_permission"
  intro: ReactNode
  applyLabel: string
  sendWaiverReason?: boolean
  placeholder: string
  badge: string
  oosModes?: boolean
}) {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode] = useState<"range" | "monthly" | "indefinite">("range")
  const [month, setMonth] = useState(() => toLocalISODate().slice(0, 7))
  const [startDate, setStartDate] = useState(toLocalISODate())
  const [endDate, setEndDate] = useState(toLocalISODate())
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const entriesQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceManager("manual-records", { status }),
    queryFn: async () => {
      try {
        const payload = await apiJson<{ data?: ManualRecord[] }>(
          `/api/admin/hr/attendance/records/manual?status=${status}`,
          { cache: "no-store" }
        )
        return groupRecords(payload.data ?? [])
      } catch {
        return []
      }
    },
  })
  const entries = entriesQuery.data ?? null
  const [listSearch, setListSearch] = useState("")
  const [pastView, setPastView] = useState(false)
  const [confirmGroup, setConfirmGroup] = useState<EntryGroup | null>(null)
  const [deleting, setDeleting] = useState(false)
  // When set: a punch conflict was detected — incomplete days will be overridden, complete days skipped.
  const [confirmOverride, setConfirmOverride] = useState<{ incomplete: number; complete: number } | null>(null)

  // Indefinite OOS directives (open-ended) — only used when oosModes is set.
  const openOosQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceManager("oos-periods"),
    queryFn: async () => {
      try {
        const payload = await apiJson<{ data?: OpenOosPeriod[] }>("/api/admin/hr/attendance/oos-periods", {
          cache: "no-store",
        })
        return payload.data ?? []
      } catch {
        return []
      }
    },
    enabled: Boolean(oosModes),
  })
  const openOos = openOosQuery.data ?? null
  const [stopping, setStopping] = useState<OpenOosPeriod | null>(null)
  const [stopBusy, setStopBusy] = useState(false)

  // Edit modal state
  const [editing, setEditing] = useState<EntryGroup | null>(null)
  const [eStart, setEStart] = useState("")
  const [eEnd, setEEnd] = useState("")
  const [eComment, setEComment] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const loadEntries = useCallback(async () => {
    await entriesQuery.refetch()
  }, [entriesQuery])

  const loadOpenOos = useCallback(async () => {
    await openOosQuery.refetch()
  }, [openOosQuery])

  /** First and last calendar day of a YYYY-MM month. */
  function monthBounds(ym: string): { start: string; end: string } {
    const [y, m] = ym.split("-").map(Number)
    const start = `${ym}-01`
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { start, end: `${ym}-${String(last).padStart(2, "0")}` }
  }

  async function deleteIds(ids: string[]): Promise<boolean> {
    const res = await apiFetch("/api/admin/hr/attendance/records/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      toast.error(payload?.error || "Failed to delete records")
      return false
    }
    return true
  }

  async function postRange(
    userIds: string[],
    start: string,
    end: string,
    commentText: string
  ): Promise<{ created: number; overrode: number; overridden: number; skipped: number } | null> {
    const res = await apiFetch("/api/admin/hr/attendance/records/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_ids: userIds,
        start_date: start,
        end_date: end,
        status,
        manual_comment: commentText,
      }),
    })
    const payload = (await res.json().catch(() => null)) as {
      error?: string
      created?: number
      overrode?: number
      overridden?: number
      skipped?: number
    } | null
    if (!res.ok) {
      toast.error(payload?.error || "Failed to apply")
      return null
    }
    return {
      created: payload?.created ?? 0,
      overrode: payload?.overrode ?? 0,
      overridden: payload?.overridden ?? 0,
      skipped: payload?.skipped ?? 0,
    }
  }

  /**
   * Split the selected employees' days in the range into fully-present (clock-in AND
   * clock-out) vs incomplete (a punch but no complete day). OOS skips the former and
   * overrides the latter; waiver overrides both.
   */
  async function countPunched(
    userIds: string[],
    start: string,
    end: string
  ): Promise<{ complete: number; incomplete: number }> {
    try {
      const qs = new URLSearchParams({ start_date: start, end_date: end })
      const res = await apiFetch(`/api/admin/hr/attendance/records?${qs.toString()}`, { cache: "no-store" })
      const payload = (await res.json().catch(() => null)) as {
        records?: Array<{ user_id: string; clock_in: string | null; clock_out: string | null }>
      } | null
      const sel = new Set(userIds)
      let complete = 0
      let incomplete = 0
      for (const r of payload?.records ?? []) {
        if (!sel.has(r.user_id)) continue
        if (r.clock_in && r.clock_out) complete++
        else if (r.clock_in || r.clock_out) incomplete++
      }
      return { complete, incomplete }
    } catch {
      return { complete: 0, incomplete: 0 }
    }
  }

  async function save() {
    if (selectedIds.length === 0) return toast.error("Select at least one employee")
    if (!comment.trim()) return toast.error("A comment is required")

    if (oosModes && mode === "indefinite") {
      if (!startDate) return toast.error("Choose a start date")
      const todayIso = toLocalISODate()
      setSaving(true)
      const { complete, incomplete } = await countPunched(selectedIds, startDate, todayIso)
      setSaving(false)
      if (incomplete > 0) return setConfirmOverride({ incomplete, complete })
      return applyIndefinite()
    }

    const start = oosModes && mode === "monthly" ? monthBounds(month).start : startDate
    const end = oosModes && mode === "monthly" ? monthBounds(month).end : endDate
    if (!start || !end || end < start) return toast.error("Set a valid date range")

    setSaving(true)
    const { complete, incomplete } = await countPunched(selectedIds, start, end)
    setSaving(false)
    // OOS only overrides incomplete days (fully-present days are skipped); waiver overrides all.
    const conflicts = status === "out_of_station" ? incomplete : complete + incomplete
    if (conflicts > 0) return setConfirmOverride({ incomplete, complete })
    await doApply(start, end)
  }

  /** Dispatch the correct apply after the override confirm. */
  async function proceed() {
    setConfirmOverride(null)
    if (oosModes && mode === "indefinite") return applyIndefinite()
    const start = oosModes && mode === "monthly" ? monthBounds(month).start : startDate
    const end = oosModes && mode === "monthly" ? monthBounds(month).end : endDate
    await doApply(start, end)
  }

  async function doApply(start: string, end: string) {
    setConfirmOverride(null)
    setSaving(true)
    try {
      const result = await postRange(selectedIds, start, end, comment.trim())
      if (!result) return
      const parts: string[] = []
      if (result.overridden > 0) parts.push(`${result.overridden} incomplete day(s) overridden (restorable)`)
      if (result.skipped > 0) parts.push(`${result.skipped} fully-present day(s) skipped`)
      if (parts.length > 0) toast.warning(`Applied — ${parts.join("; ")}.`)
      else toast.success(`Applied for ${selectedIds.length} employee(s)`)
      setSelectedIds([])
      setComment("")
      void loadEntries()
      onDone()
    } catch (err) {
      log.error({ err: String(err) }, "manual record save failed")
      toast.error("Failed to apply")
    } finally {
      setSaving(false)
    }
  }

  async function applyIndefinite() {
    setConfirmOverride(null)
    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/hr/attendance/oos-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedIds, start_date: startDate, reason: comment.trim() }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string; skipped?: number } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to apply indefinite OOS")
        return
      }
      toast.success(
        `Indefinite OOS applied to ${selectedIds.length} employee(s)${payload?.skipped ? ` — ${payload.skipped} fully-present day(s) skipped` : ""}`
      )
      setSelectedIds([])
      setComment("")
      void loadEntries()
      void loadOpenOos()
      onDone()
    } catch (err) {
      log.error({ err: String(err) }, "indefinite OOS save failed")
      toast.error("Failed to apply indefinite OOS")
    } finally {
      setSaving(false)
    }
  }

  async function stopIndefinite() {
    if (!stopping) return
    setStopBusy(true)
    try {
      const res = await apiFetch(`/api/admin/hr/attendance/oos-periods?id=${encodeURIComponent(stopping.id)}`, {
        method: "DELETE",
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to stop indefinite OOS")
        return
      }
      toast.success("Indefinite OOS stopped — days up to today are kept")
      setStopping(null)
      void loadOpenOos()
      void loadEntries()
      onDone()
    } finally {
      setStopBusy(false)
    }
  }

  function openEdit(group: EntryGroup) {
    setEditing(group)
    setEStart(group.start)
    setEEnd(group.end)
    setEComment(group.comment ?? "")
  }

  async function saveEdit() {
    if (!editing) return
    if (!eStart || !eEnd || eEnd < eStart || !eComment.trim()) return toast.error("Set a valid date range and comment")
    setEditSaving(true)
    try {
      // Edit = delete the old range then create the new one cleanly.
      const removed = await deleteIds(editing.ids)
      if (!removed) return
      const result = await postRange([editing.user_id], eStart, eEnd, eComment.trim())
      if (!result) return
      toast.success("Entry updated")
      setEditing(null)
      void loadEntries()
      onDone()
    } finally {
      setEditSaving(false)
    }
  }

  async function doDelete() {
    if (!confirmGroup) return
    setDeleting(true)
    try {
      const ok = await deleteIds(confirmGroup.ids)
      if (!ok) return
      toast.success("Entry removed")
      setConfirmGroup(null)
      void loadEntries()
      onDone()
    } finally {
      setDeleting(false)
    }
  }

  const today = toLocalISODate()
  const listQuery = listSearch.trim().toLowerCase()
  const visible = (entries ?? [])
    .filter((g) => (pastView ? g.end < today : g.end >= today))
    .filter((g) => `${g.user_name} ${g.comment ?? ""}`.toLowerCase().includes(listQuery))

  return (
    <div className="space-y-4 pt-2">
      <p className="text-muted-foreground text-sm">{intro}</p>
      <EmployeeCheckList
        reports={reports}
        selected={selectedIds}
        onChange={setSelectedIds}
        search={search}
        onSearchChange={setSearch}
      />
      {oosModes && (
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="range">Custom date range</SelectItem>
              <SelectItem value="monthly">Whole month</SelectItem>
              <SelectItem value="indefinite">Indefinite (until stopped)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {oosModes && mode === "monthly" ? (
        <div className="space-y-1">
          <Label>Month</Label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
      ) : oosModes && mode === "indefinite" ? (
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <p className="text-muted-foreground text-xs">
            Applies from this date onward and keeps extending each workday until you stop it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input
              type="date"
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className="space-y-1">
        <Label>
          Comment <span className="text-destructive">*</span>
        </Label>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={placeholder} rows={2} />
      </div>
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {status === "out_of_station" ? (
          <>
            ⚠ Days the employee was <strong>fully present</strong> (clocked in and out) are skipped — you can&apos;t be
            out of station and in the office. A day with a clock-in but <strong>no clock-out</strong> (left mid-day) is
            overridden; the punch is kept, so removing this entry restores it.
          </>
        ) : (
          <>
            ⚠ Days where the employee already clocked in <strong>will be overridden</strong>. Their clock-ins are
            preserved — removing this entry restores the original attendance.
          </>
        )}
      </p>
      <Button
        type="button"
        className="w-full"
        disabled={saving || selectedIds.length === 0}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : applyLabel}
      </Button>

      {oosModes && (openOos?.length ?? 0) > 0 && (
        <EntriesPanel
          title="Active indefinite OOS"
          loading={openOos === null}
          count={openOos?.length ?? 0}
          emptyText=""
        >
          {(openOos ?? []).map((p) => (
            <EntryRow
              key={p.id}
              primary={p.user_name}
              badge={`Indefinite • from ${formatDay(p.start_date)}`}
              comment={p.reason}
              onDelete={() => setStopping(p)}
              busy={false}
            />
          ))}
        </EntriesPanel>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" variant={pastView ? "outline" : "default"} onClick={() => setPastView(false)}>
          Current
        </Button>
        <Button type="button" size="sm" variant={pastView ? "default" : "outline"} onClick={() => setPastView(true)}>
          Past
        </Button>
      </div>

      <EntriesPanel
        title={pastView ? "Past entries" : "Current entries"}
        loading={entries === null}
        count={visible.length}
        emptyText={pastView ? "No past entries" : "No current entries"}
        search={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder="Search entries…"
      >
        {visible.map((group) => (
          <EntryRow
            key={group.ids.join(",")}
            primary={group.user_name}
            badge={`${badge} • ${formatRangeLabel(group.start, group.end)}`}
            comment={group.comment}
            onEdit={() => openEdit(group)}
            onDelete={() => setConfirmGroup(group)}
            busy={false}
          />
        ))}
      </EntriesPanel>

      {/* Edit modal */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {badge} entry</DialogTitle>
            <DialogDescription>{editing ? editing.user_name : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={eStart} onChange={(e) => setEStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" min={eStart || undefined} value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>
                Comment <span className="text-destructive">*</span>
              </Label>
              <Textarea value={eComment} onChange={(e) => setEComment(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmGroup !== null}
        onOpenChange={(o) => !o && setConfirmGroup(null)}
        title={`Remove ${badge} entry?`}
        description={
          confirmGroup
            ? `This removes ${confirmGroup.user_name}'s ${badge} (${formatRangeLabel(confirmGroup.start, confirmGroup.end)}).`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => void doDelete()}
        busy={deleting}
      />

      <ConfirmDialog
        open={confirmOverride !== null}
        onOpenChange={(o) => !o && setConfirmOverride(null)}
        title="Some days have clock-ins"
        description={
          confirmOverride
            ? status === "out_of_station"
              ? `${confirmOverride.incomplete} day(s) have a clock-in but no clock-out (looks like they left mid-day) — applying OOS will override those.${confirmOverride.complete > 0 ? ` ${confirmOverride.complete} fully-present day(s) are skipped.` : ""} Punches are kept and restored if you remove this entry. Proceed?`
              : `${confirmOverride.complete + confirmOverride.incomplete} of these day(s) already have a clock-in. Applying ${badge} will override them. Their attendance is kept and restored if you remove this entry. Proceed?`
            : undefined
        }
        confirmLabel="Proceed"
        onConfirm={() => void proceed()}
        busy={saving}
      />

      <ConfirmDialog
        open={stopping !== null}
        onOpenChange={(o) => !o && setStopping(null)}
        title="Stop indefinite OOS?"
        description={
          stopping
            ? `This stops ${stopping.user_name}'s indefinite OOS at today. Every OOS day up to today is kept; no new OOS days are added going forward.`
            : undefined
        }
        confirmLabel="Stop"
        onConfirm={() => void stopIndefinite()}
        busy={stopBusy}
      />
    </div>
  )
}
