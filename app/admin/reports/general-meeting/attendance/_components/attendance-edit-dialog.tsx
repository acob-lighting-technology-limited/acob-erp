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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CheckCircle2, Loader2, Trash2, UserCheck } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import type { AttendanceRosterItem } from "@/app/api/reports/general-meeting/attendance/route"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: AttendanceRosterItem | null
  week: number
  year: number
  onSuccess: () => void
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—"
  const timeOnlyMatch = value.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)
  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1])
    const minutes = Number(timeOnlyMatch[2])
    if (hours <= 23 && minutes <= 59) {
      const period = hours >= 12 ? "PM" : "AM"
      const displayHour = hours % 12 || 12
      return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`
    }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
}

export function AttendanceEditDialog({ open, onOpenChange, item, week, year, onSuccess }: Props) {
  const [status, setStatus] = useState<string>("present")
  const [attendanceMode, setAttendanceMode] = useState<string>("physical")
  const [meetingTime, setMeetingTime] = useState<string>("")
  const [comment, setComment] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!item) return
    setStatus(item.status === "unrecorded" ? "present" : item.status)
    setAttendanceMode(item.attendance_mode || "physical")
    setComment(item.manual_comment || "")
    if (item.meeting_clock_in) {
      try {
        const d = new Date(item.meeting_clock_in)
        const hh = String(d.getHours()).padStart(2, "0")
        const mm = String(d.getMinutes()).padStart(2, "0")
        setMeetingTime(`${hh}:${mm}`)
      } catch {
        setMeetingTime("")
      }
    } else {
      setMeetingTime("")
    }
  }, [item])

  if (!item) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      let resolvedDateTime: string | undefined
      if (meetingTime) {
        const today = new Date()
        const [h, m] = meetingTime.split(":").map(Number)
        today.setHours(h || 0, m || 0, 0, 0)
        resolvedDateTime = today.toISOString()
      }

      const res = await apiFetch("/api/reports/general-meeting/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          year,
          userId: item.id,
          action: "manual_upsert",
          status,
          attendanceMode,
          meetingClockIn: resolvedDateTime,
          manualComment: comment.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update record")

      toast.success(`Updated attendance for ${item.full_name}`)
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving attendance")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await apiFetch("/api/reports/general-meeting/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          year,
          userId: item.id,
          action: "manual_delete",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to remove record")

      toast.success(`Removed meeting attendance for ${item.full_name}`)
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error removing attendance")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="text-primary h-5 w-5" />
            Manage Attendance: {item.full_name}
          </DialogTitle>
          <DialogDescription>
            {item.department} {item.designation ? `• ${item.designation}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Biometric punch info */}
          <div className="bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Office Entrance Punch:</span>
            <span className="text-foreground font-semibold">
              {item.office_clock_in
                ? `${formatTime(item.office_clock_in)} (${item.office_clock_in_source || "biometric"})`
                : "No punch recorded"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Meeting Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="excused">Excused</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Attendance Mode</Label>
              <Select value={attendanceMode} onValueChange={setAttendanceMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">Physical (In Room)</SelectItem>
                  <SelectItem value="virtual">Online (Teams / Virtual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Meeting Check-In Time (HH:MM)</Label>
            <Input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Coordinator Comment / Reason (Optional)</Label>
            <Textarea
              placeholder="e.g. Confirmed in room, forgot phone, or permission granted"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="text-xs"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          {item.meeting_clock_in ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-destructive hover:bg-destructive/10"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              Remove
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              Save Attendance
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
