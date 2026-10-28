"use client"

import type { Dispatch, SetStateAction } from "react"
import type { AttendanceRecord } from "../view"
import { formatDate } from "../view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EditAttendanceRecordDialogProps {
  editRecord: AttendanceRecord | null
  setEditRecord: Dispatch<SetStateAction<AttendanceRecord | null>>
  isOnTimePresent: boolean
  isOverridden: boolean
  editForm: { status: string; manual_comment: string }
  setEditForm: Dispatch<SetStateAction<{ status: string; manual_comment: string }>>
  statusOptions: { value: string; label: string }[]
  handleRevert: () => Promise<void>
  reverting: boolean
  saving: boolean
  saveEdit: () => Promise<void>
  cannotSave: boolean
}

export function EditAttendanceRecordDialog({
  editRecord,
  setEditRecord,
  isOnTimePresent,
  isOverridden,
  editForm,
  setEditForm,
  statusOptions,
  handleRevert,
  reverting,
  saving,
  saveEdit,
  cannotSave,
}: EditAttendanceRecordDialogProps) {
  return (
    <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Attendance Record</DialogTitle>
          <DialogDescription>
            {editRecord && `${editRecord.user_name} — ${formatDate(editRecord.date)}`}
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
                  value={editForm.manual_comment}
                  onChange={(e) => setEditForm((f) => ({ ...f, manual_comment: e.target.value }))}
                  placeholder="Reason for this manual attendance change"
                />
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
            <Button variant="outline" onClick={() => setEditRecord(null)} disabled={saving || reverting}>
              Cancel
            </Button>
            {(!isOnTimePresent || !isOverridden) && (
              <Button onClick={saveEdit} disabled={cannotSave || reverting}>
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
