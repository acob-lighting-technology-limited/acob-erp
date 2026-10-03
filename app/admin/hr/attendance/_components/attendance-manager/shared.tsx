"use client"

/** Types, helpers and small shared pieces of the attendance manager. Split from attendance-manager-dialog.tsx (audit 6.1). */

import { useState, type ReactNode } from "react"
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
import { Select } from "@/components/ui/select"
import { Trash2, Pencil } from "lucide-react"
import { formatWATDate } from "@/lib/utils/date"
import { logger } from "@/lib/logger"

export const log = logger("attendance-manager-dialog")

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface AttendanceReport {
  user_id: string
  user_name: string
  department: string
  employee_no?: string
  attendance_exempt?: boolean
  exempted_days?: number
}

export interface Holiday {
  holiday_date: string
  name?: string | null
}

export interface AttendanceManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reports: AttendanceReport[]
  yearMonth: string
  holidays: Holiday[]
  onHolidaysChanged: () => void
  onReportChanged: () => void
  lockedDepartment?: string
}

// ────────────────────────────────────────────────────────────
// Date helpers + grouping
// ────────────────────────────────────────────────────────────

export function formatDay(date: string) {
  return formatWATDate(date, { month: "short", day: "numeric" })
}

/** "Jun 12" for a single day, "Jun 15 – 17" / "Jun 30 – Jul 2" for a range. */
export function formatRangeLabel(start: string, end: string) {
  if (start === end) return formatDay(start)
  return `${formatDay(start)} – ${formatDay(end)}`
}

export interface ManualRecord {
  id: string
  user_id: string
  user_name: string
  date: string
  manual_comment: string | null
}

export interface EntryGroup {
  user_id: string
  user_name: string
  ids: string[]
  start: string
  end: string
  comment: string | null
}

/** Groups per-day manual records (same employee + comment, contiguous workdays) into ranges. */
export function groupRecords(records: ManualRecord[]): EntryGroup[] {
  const byKey = new Map<string, ManualRecord[]>()
  for (const r of records) {
    const key = `${r.user_id}::${r.manual_comment ?? ""}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(r)
  }

  const groups: EntryGroup[] = []
  for (const list of byKey.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let cur: ManualRecord[] = []
    const flush = () => {
      if (cur.length === 0) return
      groups.push({
        user_id: cur[0].user_id,
        user_name: cur[0].user_name,
        ids: cur.map((c) => c.id),
        start: cur[0].date,
        end: cur[cur.length - 1].date,
        comment: cur[0].manual_comment,
      })
      cur = []
    }
    for (const r of list) {
      if (cur.length === 0) {
        cur = [r]
        continue
      }
      const prev = cur[cur.length - 1].date
      const gapDays = (Date.parse(`${r.date}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86_400_000
      // Bridge weekends so Fri→Mon stays one range, but split on real gaps.
      if (gapDays >= 1 && gapDays <= 3) cur.push(r)
      else {
        flush()
        cur = [r]
      }
    }
    flush()
  }

  groups.sort((a, b) => b.start.localeCompare(a.start))
  return groups
}

// ────────────────────────────────────────────────────────────
// Shared presentational helpers
// ────────────────────────────────────────────────────────────

export function EntriesPanel({
  title,
  loading,
  count,
  emptyText,
  children,
  search,
  onSearchChange,
  searchPlaceholder,
}: {
  title: string
  loading: boolean
  count: number
  emptyText: string
  children: ReactNode
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
}) {
  return (
    <div className="mt-2">
      <Label className="text-muted-foreground mb-2 block text-xs tracking-wider uppercase">{title}</Label>
      {onSearchChange && (
        <Input
          className="mb-2 h-8 text-sm"
          placeholder={searchPlaceholder ?? "Search…"}
          value={search ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      )}
      <div className="max-h-56 space-y-1 overflow-auto rounded border p-2">
        {loading ? (
          <p className="text-muted-foreground py-2 text-center text-sm">Loading…</p>
        ) : count === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-sm">{search?.trim() ? "No matches" : emptyText}</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export function EntryRow({
  primary,
  badge,
  comment,
  onEdit,
  onDelete,
  busy,
}: {
  primary: string
  badge: string
  comment?: string | null
  onEdit?: () => void
  onDelete: () => void
  busy?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{primary}</span>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {badge}
          </Badge>
        </div>
        {comment ? <p className="text-muted-foreground truncate text-xs">{comment}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit} disabled={busy}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDelete} disabled={busy}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  busy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  busy?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Searchable single-employee picker (leave is per-person, so no multi-select). */
export function EmployeeSingleSelect({
  reports,
  selectedId,
  onSelect,
}: {
  reports: AttendanceReport[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const filtered = reports.filter((r) =>
    `${r.user_name} ${r.department} ${r.employee_no ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="space-y-2">
      <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-40 space-y-0.5 overflow-auto rounded border p-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-sm">No employees found</p>
        ) : (
          filtered.map((row) => (
            <label
              key={row.user_id}
              className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
            >
              <input
                type="radio"
                name="leave-employee"
                checked={selectedId === row.user_id}
                onChange={() => onSelect(row.user_id)}
              />
              <span>{row.user_name}</span>
              <span className="text-muted-foreground text-xs">({row.department})</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

export function EmployeeCheckList({
  reports,
  selected,
  onChange,
  search,
  onSearchChange,
}: {
  reports: AttendanceReport[]
  selected: string[]
  onChange: (ids: string[]) => void
  search: string
  onSearchChange: (v: string) => void
}) {
  const filtered = reports.filter((r) =>
    `${r.user_name} ${r.department} ${r.employee_no ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="space-y-2">
      <Input placeholder="Search employee…" value={search} onChange={(e) => onSearchChange(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(filtered.map((r) => r.user_id))}>
          Select All
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          Clear
        </Button>
        {selected.length > 0 && (
          <span className="text-muted-foreground ml-auto text-xs">{selected.length} selected</span>
        )}
      </div>
      <div className="max-h-44 space-y-0.5 overflow-auto rounded border p-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-sm">No employees found</p>
        ) : (
          filtered.map((row) => (
            <label
              key={row.user_id}
              className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(row.user_id)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, row.user_id] : selected.filter((id) => id !== row.user_id))
                }
              />
              <span>{row.user_name}</span>
              <span className="text-muted-foreground text-xs">({row.department})</span>
              {(row.attendance_exempt || (row.exempted_days ?? 0) > 0) && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  Exempted
                </Badge>
              )}
            </label>
          ))
        )}
      </div>
    </div>
  )
}
