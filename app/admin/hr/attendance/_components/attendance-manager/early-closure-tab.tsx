"use client"

/** Early-closure tab of the attendance manager. Split from attendance-manager-dialog.tsx (audit 6.1). */

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
// Tab: Early Closure (org-wide early office-close days)
// ────────────────────────────────────────────────────────────

export interface EarlyClosure {
  closure_date: string
  close_time: string
  name?: string | null
}

export function EarlyClosureTab({ onChanged }: { onChanged: () => void }) {
  const [date, setDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isRange, setIsRange] = useState(false)
  const [closeTime, setCloseTime] = useState("15:00")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const allQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceManager("early-closures"),
    queryFn: async () => {
      try {
        const payload = await apiJson<{ data?: EarlyClosure[] }>("/api/admin/hr/attendance/early-closures", {
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
  const [confirm, setConfirm] = useState<EarlyClosure | null>(null)
  const [busyDate, setBusyDate] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    await allQuery.refetch()
  }, [allQuery])

  async function add() {
    if (!date || !closeTime) {
      toast.error("Pick a date and closing time")
      return
    }
    setSaving(true)
    const res = await apiFetch("/api/admin/hr/attendance/early-closures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closure_date: date,
        closure_date_end: isRange && endDate ? endDate : undefined,
        close_time: closeTime,
        name: name.trim() || undefined,
      }),
    })
    const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
    if (!res.ok) {
      toast.error(payload?.error || "Failed to add early closure")
    } else {
      toast.success(payload?.message || "Early closure added")
      setDate("")
      setEndDate("")
      setName("")
      void loadAll()
      onChanged()
    }
    setSaving(false)
  }

  async function remove(closureDate: string) {
    setBusyDate(closureDate)
    try {
      const res = await apiFetch(
        `/api/admin/hr/attendance/early-closures?closure_date=${encodeURIComponent(closureDate)}`,
        { method: "DELETE" }
      )
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to remove early closure")
        return
      }
      toast.success("Early closure removed")
      void loadAll()
      onChanged()
    } finally {
      setBusyDate(null)
    }
  }

  const listQuery = listSearch.trim().toLowerCase()
  const visible = (all ?? []).filter((c) => `${c.name ?? ""} ${c.closure_date}`.toLowerCase().includes(listQuery))

  return (
    <div className="space-y-4 pt-2">
      <p className="text-muted-foreground text-sm">
        Mark a day the whole office closed early. Staff who left <strong>at or after</strong> the closing time are not
        penalised; anyone who left before it still counts as Left Early.
      </p>
      <div className="flex items-center gap-3">
        <Switch
          id="mgr-closure-range"
          checked={isRange}
          onCheckedChange={(c) => {
            setIsRange(c)
            if (!c) setEndDate("")
          }}
        />
        <Label htmlFor="mgr-closure-range">Date range (multiple days)</Label>
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
              Closing Time <span className="text-destructive">*</span>
            </Label>
            <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
          </div>
        )}
      </div>
      {isRange && (
        <div className="space-y-1">
          <Label>
            Closing Time <span className="text-destructive">*</span>
          </Label>
          <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
        </div>
      )}
      <div className="space-y-1">
        <Label>Reason / Note</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Company end-of-year event" />
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={!date || !closeTime || saving || (isRange && (!endDate || endDate < date))}
        onClick={() => void add()}
      >
        {saving ? "Saving…" : isRange ? "Add Early Closures" : "Add Early Closure"}
      </Button>

      <EntriesPanel
        title="All early closures"
        loading={all === null}
        count={visible.length}
        emptyText="No early closures configured"
        search={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder="Search early closures…"
      >
        {visible.map((c) => (
          <EntryRow
            key={c.closure_date}
            primary={`${formatDay(c.closure_date)} • closes ${c.close_time.slice(0, 5)}`}
            badge="Early Closure"
            comment={c.name}
            onDelete={() => setConfirm(c)}
            busy={busyDate === c.closure_date}
          />
        ))}
      </EntriesPanel>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Remove early closure?"
        description={
          confirm ? `This removes the early closure on ${formatDay(confirm.closure_date)} for everyone.` : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirm) void remove(confirm.closure_date)
          setConfirm(null)
        }}
        busy={confirm ? busyDate === confirm.closure_date : false}
      />
    </div>
  )
}
