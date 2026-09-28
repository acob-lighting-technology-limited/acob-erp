"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { toast } from "sonner"
import { CheckCircle2, Clock, Laptop, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import type { AttendanceRosterItem } from "@/app/api/reports/general-meeting/attendance/route"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: AttendanceRosterItem | null
  meetingDate?: string
  week: number
  year: number
  onSuccess: () => void
}

function getNowTimeString(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function formatTimeString(value: string | null): string {
  if (!value) return "—"
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match) {
    const hours = Number(match[1])
    const minutes = Number(match[2])
    const period = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 || 12
    return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`
  }
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  }
  return value
}

export function AttendanceConfirmDialog({ open, onOpenChange, item, meetingDate, week, year, onSuccess }: Props) {
  const [meetingTime, setMeetingTime] = useState<string>("")
  const [saving, setSaving] = useState(false)

  const isPhysical = Boolean(item?.office_clock_in)
  const defaultMode = isPhysical ? "physical" : "virtual"

  useEffect(() => {
    if (open) {
      setMeetingTime(getNowTimeString())
    }
  }, [open, item])

  if (!item) return null

  const handleConfirm = async () => {
    setSaving(true)
    try {
      let resolvedDateTime: string | undefined
      if (meetingTime) {
        let baseDate = new Date()
        if (meetingDate) {
          const [yyyy, mm, dd] = meetingDate.split("-").map(Number)
          if (yyyy && mm && dd) {
            baseDate = new Date(yyyy, mm - 1, dd)
          }
        }
        const [h, m] = meetingTime.split(":").map(Number)
        baseDate.setHours(h || 0, m || 0, 0, 0)
        resolvedDateTime = baseDate.toISOString()
      }

      const res = await apiFetch("/api/reports/general-meeting/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          year,
          userId: item.id,
          action: "confirm_in_room",
          attendanceMode: defaultMode,
          meetingClockIn: resolvedDateTime,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to confirm attendance")

      toast.success(
        `Confirmed ${item.full_name} (${isPhysical ? "in conference room" : "online attendance"}) at ${meetingTime ? formatTimeString(meetingTime) : "now"}!`
      )
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error confirming attendance")
    } finally {
      setSaving(false)
    }
  }

  const handleSetNow = () => {
    setMeetingTime(getNowTimeString())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isPhysical ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            ) : (
              <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
                <Laptop className="h-5 w-5" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-semibold">
                {isPhysical ? "Confirm In-Room Attendance" : "Confirm Online Attendance"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set and verify the check-in time for this employee.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee summary card */}
          <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
            <div className="flex min-w-0 items-center gap-3">
              <StaffAvatar name={item.full_name} src={item.avatar_url} size="md" />
              <div className="min-w-0">
                <div className="text-foreground truncate text-sm font-medium">{item.full_name}</div>
                <div className="text-muted-foreground truncate text-xs">{item.designation || item.department}</div>
              </div>
            </div>
            {isPhysical ? (
              <Badge
                variant="outline"
                className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-400"
              >
                Physical
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border text-foreground bg-muted/60 shrink-0 text-xs">
                Virtual / Teams
              </Badge>
            )}
          </div>

          {/* Entrance punch status */}
          <div className="rounded-md border border-dashed px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Office Biometric Punch:</span>
              {item.office_clock_in ? (
                <span className="text-foreground flex items-center gap-1 font-medium">
                  <Clock className="text-muted-foreground h-3 w-3" />
                  {formatTimeString(item.office_clock_in)}
                </span>
              ) : (
                <span className="text-muted-foreground italic">No biometric clock-in recorded</span>
              )}
            </div>
          </div>

          {/* Time Picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="meeting-time-input" className="text-xs font-medium">
                Check-In Time
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary h-6 px-2 text-[11px]"
                onClick={handleSetNow}
              >
                Set to current time
              </Button>
            </div>
            <div className="relative">
              <Input
                id="meeting-time-input"
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="h-10 text-sm font-medium"
              />
            </div>
            <p className="text-muted-foreground text-[11px]">
              Adjust if the employee joined earlier or at a specific time.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={saving || !meetingTime} className="gap-1.5">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                {isPhysical ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />}
                Confirm Attendance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
