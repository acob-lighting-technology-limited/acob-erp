"use client"

/** Holidays tab of the attendance manager. Split from attendance-manager-dialog.tsx (audit 6.1). */

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatWATDate } from "@/lib/utils/date"
import { apiFetch, apiJson } from "@/lib/api-client"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

import { Holiday, formatDay, ConfirmDialog } from "./shared"

// ────────────────────────────────────────────────────────────
// Tab: Holiday
// ────────────────────────────────────────────────────────────

export function HolidayTab({ onChanged }: { onChanged: () => void }) {
  const [date, setDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isRange, setIsRange] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const allHolidaysQuery = useQuery({
    queryKey: QUERY_KEYS.attendanceManager("holidays"),
    queryFn: async () => {
      try {
        const payload = await apiJson<{ data?: Holiday[] }>("/api/admin/hr/attendance/holidays", { cache: "no-store" })
        return payload.data ?? []
      } catch {
        return []
      }
    },
  })
  const allHolidays = allHolidaysQuery.data ?? null
  const [busyDate, setBusyDate] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState("")
  const [confirmHoliday, setConfirmHoliday] = useState<Holiday | null>(null)

  const loadAll = useCallback(async () => {
    await allHolidaysQuery.refetch()
  }, [allHolidaysQuery])

  async function addHoliday() {
    if (!date || !name.trim()) {
      toast.error("Please fill in the date and name")
      return
    }
    setSaving(true)
    const res = await apiFetch("/api/admin/hr/attendance/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        holiday_date: date,
        holiday_date_end: isRange && endDate ? endDate : undefined,
        name: name || undefined,
      }),
    })
    const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
    if (!res.ok) {
      toast.error(payload?.error || "Failed to add holiday")
    } else {
      toast.success(payload?.message || "Holiday added")
      setDate("")
      setEndDate("")
      setName("")
      void loadAll()
      onChanged()
    }
    setSaving(false)
  }

  async function removeHoliday(holidayDate: string) {
    setBusyDate(holidayDate)
    try {
      const res = await apiFetch(`/api/admin/hr/attendance/holidays?holiday_date=${encodeURIComponent(holidayDate)}`, {
        method: "DELETE",
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(payload?.error || "Failed to remove holiday")
        return
      }
      toast.success("Holiday removed")
      void loadAll()
      onChanged()
    } finally {
      setBusyDate(null)
    }
  }

  // Group holidays by YYYY-MM for month headings (filtered by the list search)
  const listQuery = listSearch.trim().toLowerCase()
  const visibleHolidays = (allHolidays ?? []).filter((h) =>
    `${h.name ?? ""} ${h.holiday_date}`.toLowerCase().includes(listQuery)
  )
  const byMonth = new Map<string, Holiday[]>()
  for (const h of visibleHolidays) {
    const ym = h.holiday_date.slice(0, 7)
    if (!byMonth.has(ym)) byMonth.set(ym, [])
    byMonth.get(ym)!.push(h)
  }
  const monthKeys = [...byMonth.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <Switch
          id="mgr-holiday-range"
          checked={isRange}
          onCheckedChange={(c) => {
            setIsRange(c)
            if (!c) setEndDate("")
          }}
        />
        <Label htmlFor="mgr-holiday-range">Date range (multiple days)</Label>
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
              Name <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Workers Day" />
          </div>
        )}
      </div>
      {isRange && (
        <div className="space-y-1">
          <Label>
            Name <span className="text-destructive">*</span>
          </Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Christmas Break" />
        </div>
      )}
      <Button
        type="button"
        className="w-full"
        disabled={!date || !name.trim() || saving || (isRange && (!endDate || endDate < date))}
        onClick={() => void addHoliday()}
      >
        {saving ? "Saving…" : isRange ? "Add Holidays" : "Add Holiday"}
      </Button>

      <div className="mt-2">
        <Label className="text-muted-foreground mb-2 block text-xs tracking-wider uppercase">All holidays</Label>
        <Input
          className="mb-2 h-8 text-sm"
          placeholder="Search holidays…"
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
        />
        <div className="max-h-60 space-y-2 overflow-auto rounded border p-2">
          {allHolidays === null ? (
            <p className="text-muted-foreground py-2 text-center text-sm">Loading…</p>
          ) : monthKeys.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              {listQuery ? "No matches" : "No holidays configured"}
            </p>
          ) : (
            monthKeys.map((ym) => (
              <div key={ym} className="space-y-1">
                <p className="text-muted-foreground px-1 text-xs font-semibold uppercase">
                  {formatWATDate(`${ym}-01`, { month: "long", year: "numeric" })}
                </p>
                {byMonth.get(ym)!.map((h) => (
                  <div
                    key={h.holiday_date}
                    className="flex items-center justify-between rounded border px-2 py-1.5 text-sm"
                  >
                    <span>
                      {formatDay(h.holiday_date)}
                      {h.name ? ` • ${h.name}` : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={busyDate === h.holiday_date}
                      onClick={() => setConfirmHoliday(h)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmHoliday !== null}
        onOpenChange={(o) => !o && setConfirmHoliday(null)}
        title="Remove holiday?"
        description={
          confirmHoliday
            ? `This removes ${formatDay(confirmHoliday.holiday_date)}${confirmHoliday.name ? ` • ${confirmHoliday.name}` : ""} for everyone.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmHoliday) void removeHoliday(confirmHoliday.holiday_date)
          setConfirmHoliday(null)
        }}
        busy={confirmHoliday ? busyDate === confirmHoliday.holiday_date : false}
      />
    </div>
  )
}
