"use client"

/** Exemptions tab of the attendance manager. Split from attendance-manager-dialog.tsx (audit 6.1). */

import { useCallback, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { toLocalISODate } from "@/lib/hr/attendance-utils"
import { apiFetch, apiJson } from "@/lib/api-client"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

import {
  log,
  AttendanceReport,
  formatRangeLabel,
  EntriesPanel,
  EntryRow,
  ConfirmDialog,
  EmployeeCheckList,
} from "./shared"

// ────────────────────────────────────────────────────────────
// Tab: Exemption
// ────────────────────────────────────────────────────────────

export interface ExemptionEntry {
  kind: "permanent" | "period"
  id: string | null
  user_id: string
  user_name: string
  start_date: string | null
  end_date: string | null
  reason: string | null
}

export function ExemptionTab({
  reports,
  yearMonth,
  onDone,
}: {
  reports: AttendanceReport[]
  yearMonth: string
  onDone: () => void
}) {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mode, setMode] = useState<"off" | "infinite" | "weekly" | "monthly" | "period">("off")
  const [month, setMonth] = useState(yearMonth)
  const [weeks, setWeeks] = useState<number[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const entriesQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceManager("exemptions"),
    queryFn: async () => {
      try {
        const payload = await apiJson<{ data?: ExemptionEntry[] }>("/api/admin/hr/attendance/exemptions?list=1", {
          cache: "no-store",
        })
        return payload.data ?? []
      } catch {
        return []
      }
    },
  })
  const entries = entriesQuery.data ?? null
  const [listSearch, setListSearch] = useState("")
  const [pastView, setPastView] = useState(false)
  const [confirmEntry, setConfirmEntry] = useState<ExemptionEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState<ExemptionEntry | null>(null)
  const [eStart, setEStart] = useState("")
  const [eEnd, setEEnd] = useState("")
  const [eReason, setEReason] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const loadEntries = useCallback(async () => {
    await entriesQuery.refetch()
  }, [entriesQuery])

  async function save() {
    if (selectedIds.length === 0) {
      toast.error("Select at least one employee")
      return
    }
    if (mode !== "off" && !reason.trim()) {
      toast.error("A comment is required")
      return
    }
    setSaving(true)
    try {
      // Custom periods are additive — adding/editing one window must not wipe an
      // employee's other exemption periods. Edit = delete the old period + add the new.
      if (mode === "period") {
        if (!startDate || !endDate || endDate < startDate) {
          toast.error("Choose a valid start and end date")
          return
        }
        // Additive — adds a window per selected employee without touching their others.
        for (const uid of selectedIds) {
          const res = await apiFetch("/api/admin/hr/attendance/exemptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: uid, start_date: startDate, end_date: endDate, reason: reason.trim() }),
          })
          if (!res.ok) {
            const payload = (await res.json().catch(() => null)) as { error?: string } | null
            toast.error(payload?.error || "Failed to add exemption")
            return
          }
        }
        toast.success("Exemption saved")
        setSelectedIds([])
        setReason("")
        void loadEntries()
        onDone()
        return
      }

      // Pattern modes (off/weekly/monthly/infinite) deterministically rebuild the set.
      const body: Record<string, unknown> = {
        user_ids: selectedIds,
        mode,
        reason: mode === "off" ? undefined : reason.trim(),
      }
      if (mode === "weekly") {
        body.month = month
        body.weeks = weeks
      }
      if (mode === "monthly") body.months = months
      const res = await apiFetch("/api/admin/hr/attendance/exemptions/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to save exemption")
        return
      }
      toast.success("Exemption saved")
      setSelectedIds([])
      setReason("")
      void loadEntries()
      onDone()
    } catch (err) {
      log.error({ err: String(err) }, "exemption save failed")
      toast.error("Failed to save exemption")
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    if (!confirmEntry) return
    const entry = confirmEntry
    setDeleting(true)
    try {
      const res =
        entry.kind === "period" && entry.id
          ? await apiFetch(`/api/admin/hr/attendance/exemptions?period_id=${encodeURIComponent(entry.id)}`, {
              method: "DELETE",
            })
          : await apiFetch("/api/admin/hr/attendance/exemptions/bulk", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_ids: [entry.user_id], mode: "off" }),
            })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to remove exemption")
        return
      }
      toast.success("Exemption removed")
      setConfirmEntry(null)
      void loadEntries()
      onDone()
    } finally {
      setDeleting(false)
    }
  }

  function openEdit(entry: ExemptionEntry) {
    setEditing(entry)
    setEStart(entry.start_date ?? "")
    setEEnd(entry.end_date ?? "")
    setEReason(entry.reason ?? "")
  }

  async function saveEdit() {
    if (!editing || !editing.id) return
    if (!eStart || !eEnd || eEnd < eStart || !eReason.trim()) {
      toast.error("Set a valid date range and reason")
      return
    }
    setEditSaving(true)
    try {
      // Replace just this window: remove the old period, add the new one (additive).
      const del = await apiFetch(`/api/admin/hr/attendance/exemptions?period_id=${encodeURIComponent(editing.id)}`, {
        method: "DELETE",
      })
      if (!del.ok) {
        const payload = (await del.json().catch(() => null)) as { error?: string } | null
        toast.error(payload?.error || "Failed to update exemption")
        return
      }
      const res = await apiFetch("/api/admin/hr/attendance/exemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: editing.user_id, start_date: eStart, end_date: eEnd, reason: eReason.trim() }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(payload?.error || "Failed to update exemption")
        return
      }
      toast.success("Exemption updated")
      setEditing(null)
      void loadEntries()
      onDone()
    } finally {
      setEditSaving(false)
    }
  }

  const today = toLocalISODate()
  const listQuery = listSearch.trim().toLowerCase()
  const visible = (entries ?? [])
    .filter((e) =>
      pastView
        ? e.kind === "period" && (e.end_date ?? "") < today
        : !(e.kind === "period" && (e.end_date ?? "") < today)
    )
    .filter((e) => `${e.user_name} ${e.reason ?? ""}`.toLowerCase().includes(listQuery))

  return (
    <div className="space-y-4 pt-2">
      <EmployeeCheckList
        reports={reports}
        selected={selectedIds}
        onChange={setSelectedIds}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="space-y-2">
        <Label>Exemption Mode</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Disabled (remove exemption)</SelectItem>
            <SelectItem value="infinite">Permanent (until disabled)</SelectItem>
            <SelectItem value="weekly">Specific weeks in a month</SelectItem>
            <SelectItem value="monthly">Specific months</SelectItem>
            <SelectItem value="period">Custom date range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "weekly" && (
        <div className="space-y-2">
          <Label>Month</Label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
          />
          <Label>Weeks</Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((wk) => (
              <Button
                key={wk}
                type="button"
                variant={weeks.includes(wk) ? "default" : "outline"}
                size="sm"
                onClick={() => setWeeks((prev) => (prev.includes(wk) ? prev.filter((x) => x !== wk) : [...prev, wk]))}
              >
                Week {wk}
              </Button>
            ))}
          </div>
        </div>
      )}

      {mode === "monthly" && (
        <div className="space-y-2">
          <Label>Months</Label>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!months.includes(month)) setMonths((prev) => [...prev, month].sort())
              }}
            >
              Add Month
            </Button>
          </div>
          {months.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {months.map((m) => (
                <Badge key={m} variant="secondary" className="gap-1">
                  {m}
                  <button
                    type="button"
                    onClick={() => setMonths((prev) => prev.filter((x) => x !== m))}
                    className="hover:text-destructive ml-0.5"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "period" && (
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

      {mode !== "off" && (
        <div className="space-y-1">
          <Label>
            Comment <span className="text-destructive">*</span>
          </Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Remote assignment" />
        </div>
      )}

      <Button
        type="button"
        className="w-full"
        disabled={saving || selectedIds.length === 0}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : mode === "off" ? "Remove Exemption" : "Apply Exemption"}
      </Button>
      {mode !== "off" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠ Exemption takes precedence in the roster even on days the employee clocked in. Their attendance is kept —
          removing the exemption restores it.
        </p>
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
        title={pastView ? "Past exemptions" : "Current exemptions"}
        loading={entries === null}
        count={visible.length}
        emptyText={pastView ? "No past exemptions" : "No active exemptions"}
        search={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder="Search exemptions…"
      >
        {visible.map((entry) => {
          const key = entry.id ?? `permanent-${entry.user_id}`
          return (
            <EntryRow
              key={key}
              primary={entry.user_name}
              badge={
                entry.kind === "permanent"
                  ? "Permanent"
                  : entry.start_date && entry.end_date
                    ? formatRangeLabel(entry.start_date, entry.end_date)
                    : "Period"
              }
              comment={entry.reason}
              onEdit={entry.kind === "period" && entry.id ? () => openEdit(entry) : undefined}
              onDelete={() => setConfirmEntry(entry)}
              busy={false}
            />
          )
        })}
      </EntriesPanel>

      {/* Edit modal (custom periods only) */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit exemption period</DialogTitle>
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
              <Input value={eReason} onChange={(e) => setEReason(e.target.value)} />
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
        open={confirmEntry !== null}
        onOpenChange={(o) => !o && setConfirmEntry(null)}
        title="Remove exemption?"
        description={
          confirmEntry
            ? confirmEntry.kind === "permanent"
              ? `This removes ${confirmEntry.user_name}'s permanent exemption.`
              : `This removes ${confirmEntry.user_name}'s exemption window${confirmEntry.start_date && confirmEntry.end_date ? ` (${formatRangeLabel(confirmEntry.start_date, confirmEntry.end_date)})` : ""}.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => void doDelete()}
        busy={deleting}
      />
    </div>
  )
}
