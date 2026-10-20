"use client"

/** Late-resumption tab of the attendance manager. Split from attendance-manager-dialog.tsx (audit 6.1). */

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { apiFetch, apiJson } from "@/lib/api-client"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

import { formatDay, EntriesPanel, EntryRow, ConfirmDialog } from "./shared"

// ────────────────────────────────────────────────────────────
// Tab: Late Resumption (org-wide late-start days)
// ────────────────────────────────────────────────────────────

export interface LateResumption {
  resumption_date: string
  resumption_time: string
  name?: string | null
}

export function LateResumptionTab({ onChanged }: { onChanged: () => void }) {
  const [date, setDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isRange, setIsRange] = useState(false)
  const [resumptionTime, setResumptionTime] = useState("10:00")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const allQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceManager("late-resumptions"),
    queryFn: async () => {
      try {
        const payload = await apiJson<{ data?: LateResumption[] }>("/api/admin/hr/attendance/late-resumptions", {
          cache: "no-store",
        })
        return payload.data ?? []
      } catch {
        return []
      }
    },
  })
  const all = allQuery.data ?? null
  const [listSearch, setListSearch] = useState("")
  const [confirm, setConfirm] = useState<LateResumption | null>(null)
  const [busyDate, setBusyDate] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    await allQuery.refetch()
  }, [allQuery])

  async function add() {
    if (!date || !resumptionTime) {
      toast.error("Pick a date and resumption time")
      return
    }
    setSaving(true)
    const res = await apiFetch("/api/admin/hr/attendance/late-resumptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumption_date: date,
        resumption_date_end: isRange && endDate ? endDate : undefined,
        resumption_time: resumptionTime,
        name: name.trim() || undefined,
      }),
    })
    const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
    if (!res.ok) {
      toast.error(payload?.error || "Failed to add late resumption")
    } else {
      toast.success(payload?.message || "Late resumption added")
      setDate("")
      setEndDate("")
      setName("")
      void loadAll()
      onChanged()
    }
    setSaving(false)
  }

  async function remove(resumptionDate: string) {
    setBusyDate(resumptionDate)
    try {
      const res = await apiFetch(
        `/api/admin/hr/attendance/late-resumptions?resumption_date=${encodeURIComponent(resumptionDate)}`,
        { method: "DELETE" }
      )
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to remove late resumption")
        return
      }
      toast.success("Late resumption removed")
      void loadAll()
      onChanged()
    } finally {
      setBusyDate(null)
    }
  }

  const listQuery = listSearch.trim().toLowerCase()
  const visible = (all ?? []).filter((r) => `${r.name ?? ""} ${r.resumption_date}`.toLowerCase().includes(listQuery))

  return (
    <div className="space-y-4 pt-2">
      <p className="text-muted-foreground text-sm">
        Mark a day the whole office started late. Staff who clocked in <strong>at or before</strong> the resumption time
        are not penalised; anyone who arrived after it is measured from the late resumption time instead of the normal
        8:20 AM grace.
      </p>
      <div className="flex items-center gap-3">
        <Switch
          id="mgr-resumption-range"
          checked={isRange}
          onCheckedChange={(c) => {
            setIsRange(c)
            if (!c) setEndDate("")
          }}
        />
        <Label htmlFor="mgr-resumption-range">Date range (multiple days)</Label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{isRange ? "Start Date" : "Date"}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {isRange ? (
          <div className="space-y-1">
            <Label>
              End Date <span className="text-destructive">*</span>
            </Label>
            <Input type="date" min={date || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        ) : (
          <div className="space-y-1">
            <Label>
              Resumption Time <span className="text-destructive">*</span>
            </Label>
            <Input type="time" value={resumptionTime} onChange={(e) => setResumptionTime(e.target.value)} />
          </div>
        )}
      </div>
      {isRange && (
        <div className="space-y-1">
          <Label>
            Resumption Time <span className="text-destructive">*</span>
          </Label>
          <Input type="time" value={resumptionTime} onChange={(e) => setResumptionTime(e.target.value)} />
        </div>
      )}
      <div className="space-y-1">
        <Label>Reason / Note</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Heavy rainfall, road flooding"
        />
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={!date || !resumptionTime || saving || (isRange && (!endDate || endDate < date))}
        onClick={() => void add()}
      >
        {saving ? "Saving…" : isRange ? "Add Late Resumptions" : "Add Late Resumption"}
      </Button>

      <EntriesPanel
        title="All late resumptions"
        loading={all === null}
        count={visible.length}
        emptyText="No late resumptions configured"
        search={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder="Search late resumptions…"
      >
        {visible.map((r) => (
          <EntryRow
            key={r.resumption_date}
            primary={`${formatDay(r.resumption_date)} • resumes ${r.resumption_time.slice(0, 5)}`}
            badge="Late Resumption"
            comment={r.name}
            onDelete={() => setConfirm(r)}
            busy={busyDate === r.resumption_date}
          />
        ))}
      </EntriesPanel>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Remove late resumption?"
        description={
          confirm
            ? `This removes the late resumption on ${formatDay(confirm.resumption_date)} for everyone.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirm) void remove(confirm.resumption_date)
          setConfirm(null)
        }}
        busy={confirm ? busyDate === confirm.resumption_date : false}
      />
    </div>
  )
}
