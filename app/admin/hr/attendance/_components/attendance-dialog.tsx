"use client"

import type { Dispatch, SetStateAction } from "react"
import type { DayRecord, AttendanceReport } from "../view"
import { formatDayShort } from "../view"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AttendanceDialogProps {
  editTarget: { date: string; record: DayRecord | null } | null
  setEditTarget: Dispatch<SetStateAction<{ date: string; record: DayRecord | null } | null>>
  isCreating: boolean
  report: AttendanceReport
  isOnTimePresent: boolean
  isOverridden: boolean
  editForm: { status: string; manual_comment: string }
  setEditForm: Dispatch<SetStateAction<{ status: string; manual_comment: string }>>
  statusOptions: { value: string; label: string }[]
  hasManualComment: boolean
  handleRevert: () => Promise<void>
  reverting: boolean
  saving: boolean
  saveEdit: () => Promise<void>
  cannotSave: boolean
}

export function AttendanceDialog({
  editTarget,
  setEditTarget,
  isCreating,
  report,
  isOnTimePresent,
  isOverridden,
  editForm,
  setEditForm,
  statusOptions,
  hasManualComment,
  handleRevert,
  reverting,
  saving,
  saveEdit,
  cannotSave,
}: AttendanceDialogProps) {
  return (
    <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isCreating ? "Add Attendance Record" : "Edit Attendance Record"}</DialogTitle>
          <DialogDescription>
            {editTarget && `${report.user_name} — ${formatDayShort(editTarget.date)}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isOnTimePresent && !isOverridden ? (
            <p className="text-muted-foreground text-sm">
              This record is fully present and on-time. No overrides (LWP/AWP) are applicable.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm((f) => ({ ...f, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Comment (required) <span className="text-destructive">*</span>
                </Label>
                <Input
                  required
                  placeholder="Reason for this manual attendance change"
                  value={editForm.manual_comment}
                  onChange={(e) => setEditForm((f) => ({ ...f, manual_comment: e.target.value }))}
                />
                {!hasManualComment && (
                  <p className="text-xs font-medium text-red-500">
                    A comment is required for all manual attendance alterations.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {isOverridden ? (
            <Button type="button" variant="destructive" size="sm" onClick={handleRevert} disabled={reverting || saving}>
              {reverting ? "Reverting…" : "Revert Override"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving || reverting}>
              Cancel
            </Button>
            {(!isOnTimePresent || !isOverridden) && (
              <Button onClick={saveEdit} disabled={cannotSave || reverting}>
                {saving ? "Saving…" : isCreating ? "Create" : "Save"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
