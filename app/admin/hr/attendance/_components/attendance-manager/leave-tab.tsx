"use client"

/** Manual leave tab of the attendance manager. Split from attendance-manager-dialog.tsx (audit 6.1). */

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
  formatRangeLabel,
  EntriesPanel,
  EntryRow,
  ConfirmDialog,
  EmployeeSingleSelect,
} from "./shared"

// ────────────────────────────────────────────────────────────
// Tab: Leave (manual bypass)
// ────────────────────────────────────────────────────────────

export interface ManualLeave {
  id: string
  user_id: string
  user_name: string
  start_date: string
  end_date: string
  leave_type: string
  days_count: number | null
  notes: string | null
}

export interface LeaveTypeOption {
  id: string
  name: string
  /** null when the employee has no balance row for the year — remaining is untracked, not zero. */
  remaining: number | null
  /** Policy entitlement for the type (leave_types.max_days) — the "max" figure in the label. */
  maxDays: number | null
  /** Policy requires supporting documents the employee hasn't provided (admin collects offline). */
  needsEvidence: boolean
}

/** Mirrors the leave module's option label: "Annual Leave (12 days left, max 15)". */
export function leaveTypeLabel(t: LeaveTypeOption): string {
  // Uncapped types (LWOP) have no yearly allowance, so a "days left" figure would be a fiction.
  if (t.remaining == null) return `${t.name} (no annual limit — granted case by case)`
  const max = t.maxDays == null ? null : `max ${t.maxDays}`
  return `${t.name} (${[`${t.remaining} day${t.remaining === 1 ? "" : "s"} left`, max].filter(Boolean).join(", ")})`
}

export function daysInclusive(start: string, end: string): number | null {
  if (!start || !end || end < start) return null
  const ms = new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${start}T00:00:00.000Z`).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
}

export async function fetchLeaveTypeOptions(userId: string): Promise<LeaveTypeOption[]> {
  try {
    const res = await apiFetch(`/api/admin/hr/attendance/leave/balances?user_id=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    })
    const payload = (await res.json().catch(() => null)) as {
      data?: Array<{
        leave_type_id: string
        has_balance?: boolean
        eligibility_status?: string
        allocated_days?: number | null
        used_days?: number | null
        carry_forward_days?: number | null
        balance_days?: number | null
        leave_type?: { id: string; name: string; max_days?: number | null } | null
      }>
    } | null
    if (!res.ok) return []
    return (payload?.data ?? []).map((b) => {
      const remaining =
        b.has_balance === false
          ? null
          : b.balance_days != null
            ? Number(b.balance_days)
            : Number(b.allocated_days || 0) + Number(b.carry_forward_days || 0) - Number(b.used_days || 0)
      return {
        id: b.leave_type_id,
        name: b.leave_type?.name ?? "Leave",
        remaining,
        maxDays: b.leave_type?.max_days ?? null,
        needsEvidence: b.eligibility_status === "missing_evidence",
      }
    })
  } catch {
    return []
  }
}

export const NO_LEAVE_TYPES: LeaveTypeOption[] = []

export function LeaveTab({ reports, onDone }: { reports: AttendanceReport[]; onDone: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: types = NO_LEAVE_TYPES, isLoading: loadingTypes } = useQuery({
    queryKey: QUERY_KEYS.manualLeaveTypeOptions(selectedId ?? ""),
    queryFn: () => fetchLeaveTypeOptions(selectedId!),
    enabled: Boolean(selectedId),
  })
  // Default to the first type until the admin picks one for this employee.
  const [leaveTypeChoice, setLeaveTypeId] = useState("")
  const leaveTypeId = types.some((t) => t.id === leaveTypeChoice) ? leaveTypeChoice : (types[0]?.id ?? "")
  const [startDate, setStartDate] = useState(toLocalISODate())
  const [endDate, setEndDate] = useState(toLocalISODate())
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const entriesQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceManager("manual-leave"),
    queryFn: async () => {
      try {
        const payload = await apiJson<{ data?: ManualLeave[] }>("/api/admin/hr/attendance/leave/manual", {
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
  const [confirmEntry, setConfirmEntry] = useState<ManualLeave | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Edit modal state
  const [editing, setEditing] = useState<ManualLeave | null>(null)
  const [editTypes, setEditTypes] = useState<LeaveTypeOption[]>([])
  const [eTypeId, setETypeId] = useState("")
  const [eStart, setEStart] = useState("")
  const [eEnd, setEEnd] = useState("")
  const [eReason, setEReason] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const loadEntries = useCallback(async () => {
    await entriesQuery.refetch()
  }, [entriesQuery])

  // Load the selected employee's leave types + remaining balances.

  const selectedType = types.find((t) => t.id === leaveTypeId) ?? null
  const previewDays = daysInclusive(startDate, endDate)

  async function save() {
    if (!selectedId) {
      toast.error("Select an employee")
      return
    }
    if (!leaveTypeId) {
      toast.error("Select a leave type")
      return
    }
    if (!startDate || !endDate || endDate < startDate) {
      toast.error("Set a valid date range")
      return
    }
    if (!reason.trim()) {
      toast.error("A reason is required")
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/hr/attendance/leave/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedId,
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
        }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string; days_count?: number } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to add leave")
        return
      }
      toast.success(`Leave recorded (${payload?.days_count ?? previewDays ?? ""} day(s))`)
      setReason("")
      setSelectedId(null)
      void loadEntries()
      onDone()
    } catch (err) {
      log.error({ err: String(err) }, "leave save failed")
      toast.error("Failed to add leave")
    } finally {
      setSaving(false)
    }
  }

  function openEdit(entry: ManualLeave) {
    setEditing(entry)
    setEStart(entry.start_date)
    setEEnd(entry.end_date)
    setEReason(entry.notes ?? "")
    setETypeId("")
    setEditTypes([])
    void fetchLeaveTypeOptions(entry.user_id).then((opts) => {
      setEditTypes(opts)
      // Best-effort preselect the matching type by name.
      setETypeId(opts.find((o) => o.name === entry.leave_type)?.id ?? opts[0]?.id ?? "")
    })
  }

  async function saveEdit() {
    if (!editing) return
    if (!eTypeId || !eStart || !eEnd || eEnd < eStart || !eReason.trim()) {
      toast.error("Set a valid leave type, date range, and reason")
      return
    }
    setEditSaving(true)
    try {
      // Edit = revoke old grant (restores balance) then create the new one.
      const del = await apiFetch(`/api/admin/hr/attendance/leave/manual?id=${encodeURIComponent(editing.id)}`, {
        method: "DELETE",
      })
      if (!del.ok) {
        const payload = (await del.json().catch(() => null)) as { error?: string } | null
        toast.error(payload?.error || "Failed to update leave")
        return
      }
      const res = await apiFetch("/api/admin/hr/attendance/leave/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editing.user_id,
          leave_type_id: eTypeId,
          start_date: eStart,
          end_date: eEnd,
          reason: eReason.trim(),
        }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to update leave")
        return
      }
      toast.success("Leave updated")
      setEditing(null)
      void loadEntries()
      onDone()
    } finally {
      setEditSaving(false)
    }
  }

  async function doDelete() {
    if (!confirmEntry) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/admin/hr/attendance/leave/manual?id=${encodeURIComponent(confirmEntry.id)}`, {
        method: "DELETE",
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to delete leave")
        return
      }
      toast.success("Leave removed")
      setConfirmEntry(null)
      void loadEntries()
      onDone()
    } finally {
      setDeleting(false)
    }
  }

  const today = toLocalISODate()
  const listQuery = listSearch.trim().toLowerCase()
  const visible = (entries ?? [])
    .filter((e) => (pastView ? e.end_date < today : e.end_date >= today))
    .filter((e) => `${e.user_name} ${e.leave_type} ${e.notes ?? ""}`.toLowerCase().includes(listQuery))

  return (
    <div className="space-y-4 pt-2">
      <p className="text-muted-foreground text-sm">
        Record <strong>approved leave</strong> for one employee, bypassing the request workflow. It posts a real
        approved leave request, draws down their balance, and shows as &ldquo;On Leave&rdquo; in attendance.
      </p>

      <div className="space-y-1">
        <Label>Employee</Label>
        <EmployeeSingleSelect reports={reports} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <div className="space-y-1">
        <Label>Leave Type</Label>
        <Select value={leaveTypeId} onValueChange={setLeaveTypeId} disabled={!selectedId || loadingTypes}>
          <SelectTrigger>
            <SelectValue
              placeholder={!selectedId ? "Select an employee first" : loadingTypes ? "Loading…" : "Select type"}
            />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {leaveTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedId && !loadingTypes && types.length === 0 && (
          <p className="text-xs font-medium text-amber-600">
            No leave types this employee is eligible for — check their profile and leave policies.
          </p>
        )}
      </div>

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

      {selectedType && previewDays != null && (
        <p className="text-muted-foreground text-xs">
          {previewDays} day(s)
          {selectedType.remaining == null ? (
            " · no balance tracked for this type"
          ) : (
            <>
              {" · balance "}
              {selectedType.remaining} →{" "}
              <span className={selectedType.remaining - previewDays < 0 ? "font-medium text-red-600" : ""}>
                {selectedType.remaining - previewDays}
              </span>
            </>
          )}
        </p>
      )}

      <div className="space-y-1">
        <Label>
          Reason <span className="text-destructive">*</span>
        </Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Emergency family situation — pre-approved by HOD"
          rows={2}
        />
      </div>
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        ⚠ If the employee clocked in on these days, the leave takes precedence in the roster. Their attendance is kept
        — removing the leave restores it.
      </p>
      <Button
        type="button"
        className="w-full"
        disabled={saving || !selectedId || !leaveTypeId}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Add Leave Record"}
      </Button>

      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" variant={pastView ? "outline" : "default"} onClick={() => setPastView(false)}>
          Current
        </Button>
        <Button type="button" size="sm" variant={pastView ? "default" : "outline"} onClick={() => setPastView(true)}>
          Past
        </Button>
      </div>

      <EntriesPanel
        title={pastView ? "Past leave records" : "Current leave records"}
        loading={entries === null}
        count={visible.length}
        emptyText={pastView ? "No past leave records" : "No current leave records"}
        search={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder="Search leave records…"
      >
        {visible.map((entry) => (
          <EntryRow
            key={entry.id}
            primary={entry.user_name}
            badge={`${entry.leave_type} • ${formatRangeLabel(entry.start_date, entry.end_date)}${entry.days_count ? ` • ${entry.days_count}d` : ""}`}
            comment={entry.notes}
            onEdit={() => openEdit(entry)}
            onDelete={() => setConfirmEntry(entry)}
            busy={false}
          />
        ))}
      </EntriesPanel>

      {/* Edit modal */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Leave</DialogTitle>
            <DialogDescription>{editing ? editing.user_name : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Leave Type</Label>
              <Select value={eTypeId} onValueChange={setETypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {editTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {leaveTypeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea value={eReason} onChange={(e) => setEReason(e.target.value)} rows={2} />
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
        title="Remove leave record?"
        description={
          confirmEntry
            ? `This revokes ${confirmEntry.user_name}'s leave (${formatRangeLabel(confirmEntry.start_date, confirmEntry.end_date)}) and restores their balance.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => void doDelete()}
        busy={deleting}
      />
    </div>
  )
}
