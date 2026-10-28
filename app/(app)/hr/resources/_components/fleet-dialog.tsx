"use client"

import type { Dispatch, SetStateAction } from "react"
import type { FleetResource, FleetSchedule } from "../fleet-content"
import { toLocalDateTimeInput } from "../fleet-content"
import { toLocalISODate } from "@/lib/utils/date"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface FleetDialogProps {
  open: boolean
  resetModalState: () => void
  editingId: string | null
  resourceId: string
  setResourceId: Dispatch<SetStateAction<string>>
  resources: FleetResource[]
  selectedRange: { from: Date; to: Date | undefined } | undefined
  setStartAt: Dispatch<SetStateAction<string>>
  setEndAt: Dispatch<SetStateAction<string>>
  withDate: (existing: string, day: Date, fallbackTime: string) => string
  startAt: string
  endAt: string
  bookedDayKeys: Set<string>
  hasInvalidWindow: boolean
  reason: string
  setReason: Dispatch<SetStateAction<string>>
  setFiles: Dispatch<SetStateAction<File[]>>
  currentWindowConflicts: FleetSchedule[]
  handleSubmit: () => void
  canSubmit: boolean | ""
  submitting: boolean
  updating: boolean
}

export function FleetDialog({
  open,
  resetModalState,
  editingId,
  resourceId,
  setResourceId,
  resources,
  selectedRange,
  setStartAt,
  setEndAt,
  withDate,
  startAt,
  endAt,
  bookedDayKeys,
  hasInvalidWindow,
  reason,
  setReason,
  setFiles,
  currentWindowConflicts,
  handleSubmit,
  canSubmit,
  submitting,
  updating,
}: FleetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={resetModalState}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Resource Booking" : "Resource Booking Application"}</DialogTitle>
          <DialogDescription>
            {editingId
              ? "Update your pending resource booking request."
              : "Provide date/time, reason, and optional files (PDF/images)."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Resource</Label>
            <Select value={resourceId} onValueChange={setResourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select resource" />
              </SelectTrigger>
              <SelectContent>
                {resources.map((resource) => (
                  <SelectItem key={resource.id} value={resource.id}>
                    {resource.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {resourceId ? (
            <div className="space-y-2">
              <Label>Pick Dates (Calendar)</Label>
              <div className="rounded-md border p-3">
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={(range) => {
                    if (!range?.from) {
                      setStartAt("")
                      setEndAt("")
                      return
                    }
                    setStartAt(withDate(startAt, range.from, "09:00"))
                    if (range.to) setEndAt(withDate(endAt, range.to, "17:00"))
                  }}
                  showOutsideDays
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  modifiers={{ resource_busy: (date) => bookedDayKeys.has(toLocalISODate(date)) }}
                  modifiersClassNames={{ resource_busy: "bg-warning/15 text-warning font-medium" }}
                  className="mx-auto"
                />
                <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-3 rounded bg-amber-100" />
                    Already booked
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="bg-muted h-3 w-3 rounded" />
                    Past dates unavailable
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
              Select a resource to see which dates are already taken.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date & Time</Label>
              <Input
                type="datetime-local"
                value={toLocalDateTimeInput(startAt)}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date & Time</Label>
              <Input
                type="datetime-local"
                value={toLocalDateTimeInput(endAt)}
                min={startAt || undefined}
                onChange={(event) => setEndAt(event.target.value)}
              />
            </div>
          </div>

          {hasInvalidWindow ? (
            <div className="border-destructive/40 bg-destructive/5 rounded border p-3 text-sm">
              <p className="font-medium">Invalid time window</p>
              <p className="text-muted-foreground">End date and time must be after start date and time.</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="State the business reason for this booking"
              rows={4}
            />
            <p className="text-muted-foreground text-xs">Minimum 10 characters</p>
          </div>

          {!editingId && (
            <div className="space-y-2">
              <Label>Attachments (optional)</Label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <p className="text-muted-foreground text-xs">Accepted: PDF, JPG, JPEG, PNG, WEBP (max 10MB each).</p>
            </div>
          )}

          {currentWindowConflicts.length > 0 ? (
            <div className="border-destructive/40 bg-destructive/5 rounded border p-3 text-sm">
              <p className="font-medium">Time clash detected</p>
              <p className="text-muted-foreground">This slot overlaps an existing pending/approved booking.</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetModalState}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || updating || currentWindowConflicts.length > 0 || hasInvalidWindow}
          >
            {submitting || updating
              ? editingId
                ? "Updating..."
                : "Submitting..."
              : editingId
                ? "Update Booking"
                : "Submit Application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
