"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Textarea } from "@/components/ui/textarea"
import { CalendarDays } from "lucide-react"
import type { LeaveType, LeaveBalance } from "@/app/(app)/dashboard/leave/page"

function prettyEligibility(status: string) {
  if (status === "eligible") return "Eligible"
  if (status === "missing_evidence") return "Missing Evidence"
  return "Not Eligible"
}

function prettyDocName(name: string) {
  return name.replaceAll("_", " ")
}

interface LeaveRequestFormData {
  leave_type_id: string
  start_date: string
  days_count: number
  reason: string
  reliever_identifier: string
  handover_note: string
}

interface LeaveRequestFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRequestId: string | null
  formData: LeaveRequestFormData
  setFormData: React.Dispatch<React.SetStateAction<LeaveRequestFormData>>
  leaveTypes: LeaveType[]
  relieverOptions: { value: string; label: string }[]
  selectedLeaveType: LeaveType | undefined
  selectedBalance: LeaveBalance | undefined
  availableDays: number
  preview: { endDate: string; resumeDate: string }
  canSubmit: boolean
  submitting: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
}

export function LeaveRequestFormDialog({
  open,
  onOpenChange,
  editingRequestId,
  formData,
  setFormData,
  leaveTypes,
  relieverOptions,
  selectedLeaveType,
  selectedBalance: _selectedBalance,
  availableDays,
  preview,
  canSubmit,
  submitting,
  onSubmit,
}: LeaveRequestFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {editingRequestId ? "Edit Leave Request" : "Submit Leave Request"}
          </DialogTitle>
          <DialogDescription>
            Request flow: Reliever {"->"} Supervisor {"->"} HR. Changes are allowed only before reliever approval.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select
              value={formData.leave_type_id}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, leave_type_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((leaveType) => (
                  <SelectItem
                    key={leaveType.id}
                    value={leaveType.id}
                    disabled={leaveType.eligibility_status === "not_eligible"}
                  >
                    {leaveType.name} ({leaveType.max_days} days) - {prettyEligibility(leaveType.eligibility_status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Available balance: {availableDays} days</p>
            {selectedLeaveType?.eligibility_reason && (
              <p className="text-muted-foreground text-xs">{selectedLeaveType.eligibility_reason}</p>
            )}
            {selectedLeaveType?.required_documents?.length ? (
              <p className="text-muted-foreground text-xs">
                Required documents: {selectedLeaveType.required_documents.map(prettyDocName).join(", ")}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(event) => setFormData((prev) => ({ ...prev, start_date: event.target.value }))}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Days</Label>
              <Input
                type="number"
                min={1}
                value={formData.days_count}
                onChange={(event) => setFormData((prev) => ({ ...prev, days_count: Number(event.target.value || 1) }))}
              />
            </div>
          </div>

          <div className="bg-muted/40 rounded-md border p-3 text-sm">
            <p>
              Computed End Date: <span className="font-medium">{preview.endDate || "-"}</span>
            </p>
            <p>
              Computed Resume Date: <span className="font-medium">{preview.resumeDate || "-"}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Reliever</Label>
            <SearchableSelect
              value={formData.reliever_identifier}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, reliever_identifier: value }))}
              options={relieverOptions}
              placeholder="Select reliever"
              searchPlaceholder="Search employee..."
            />
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              rows={3}
              value={formData.reason}
              onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Provide leave reason"
            />
          </div>

          <div className="space-y-2">
            <Label>Handover Note</Label>
            <Textarea
              rows={3}
              value={formData.handover_note}
              onChange={(event) => setFormData((prev) => ({ ...prev, handover_note: event.target.value }))}
              placeholder="Summarize duties and handover details"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting
                ? editingRequestId
                  ? "Saving..."
                  : "Submitting..."
                : editingRequestId
                  ? "Save Changes"
                  : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
