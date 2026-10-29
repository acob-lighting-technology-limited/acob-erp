"use client"

import type { Dispatch, SetStateAction } from "react"
import { FOCUS_LABELS } from "../view"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface EditDevelopmentPlanDialogProps {
  isEditOpen: boolean
  setIsEditOpen: Dispatch<SetStateAction<boolean>>
  handleEdit: (event: React.FormEvent) => Promise<void>
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  focusArea: string
  setFocusArea: Dispatch<SetStateAction<string>>
  priority: "low" | "medium" | "high"
  setPriority: Dispatch<SetStateAction<"low" | "medium" | "high">>
  status: "active" | "completed" | "cancelled" | "on_hold"
  setStatus: Dispatch<SetStateAction<"active" | "completed" | "cancelled" | "on_hold">>
  progressPct: string
  setProgressPct: Dispatch<SetStateAction<string>>
  targetDate: string
  setTargetDate: Dispatch<SetStateAction<string>>
  description: string
  setDescription: Dispatch<SetStateAction<string>>
  isSubmitting: boolean
}

export function EditDevelopmentPlanDialog({
  isEditOpen,
  setIsEditOpen,
  handleEdit,
  title,
  setTitle,
  focusArea,
  setFocusArea,
  priority,
  setPriority,
  status,
  setStatus,
  progressPct,
  setProgressPct,
  targetDate,
  setTargetDate,
  description,
  setDescription,
  isSubmitting,
}: EditDevelopmentPlanDialogProps) {
  return (
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Development Plan</DialogTitle>
          <DialogDescription>Update the plan details, status, and progress tracking.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleEdit(event)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Plan Title *</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Focus Area</Label>
              <Select value={focusArea} onValueChange={setFocusArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FOCUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as "low" | "medium" | "high")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as "active" | "completed" | "cancelled" | "on_hold")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Progress %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={progressPct}
                onChange={(event) => setProgressPct(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
