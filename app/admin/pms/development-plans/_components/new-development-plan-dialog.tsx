"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Profile, Cycle } from "../view"
import { FOCUS_LABELS } from "../view"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { personName } from "@/lib/format"

interface NewDevelopmentPlanDialogProps {
  isCreateOpen: boolean
  setIsCreateOpen: Dispatch<SetStateAction<boolean>>
  handleCreate: (event: React.FormEvent) => Promise<void>
  selectedEmployee: string
  setSelectedEmployee: Dispatch<SetStateAction<string>>
  employees: Profile[]
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  focusArea: string
  setFocusArea: Dispatch<SetStateAction<string>>
  priority: "low" | "medium" | "high"
  setPriority: Dispatch<SetStateAction<"low" | "medium" | "high">>
  selectedCycle: string
  setSelectedCycle: Dispatch<SetStateAction<string>>
  cycles: Cycle[]
  targetDate: string
  setTargetDate: Dispatch<SetStateAction<string>>
  description: string
  setDescription: Dispatch<SetStateAction<string>>
  actionLines: string
  setActionLines: Dispatch<SetStateAction<string>>
  isSubmitting: boolean
}

export function NewDevelopmentPlanDialog({
  isCreateOpen,
  setIsCreateOpen,
  handleCreate,
  selectedEmployee,
  setSelectedEmployee,
  employees,
  title,
  setTitle,
  focusArea,
  setFocusArea,
  priority,
  setPriority,
  selectedCycle,
  setSelectedCycle,
  cycles,
  targetDate,
  setTargetDate,
  description,
  setDescription,
  actionLines,
  setActionLines,
  isSubmitting,
}: NewDevelopmentPlanDialogProps) {
  return (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Development Plan</DialogTitle>
          <DialogDescription>
            Create a development plan for an employee, optionally linked to a review cycle.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Employee *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {personName(employee)} {employee.department ? `(${employee.department})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label>Review Cycle</Label>
              <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {cycles
                    .filter((cycle) => !cycle.review_type || cycle.review_type.toLowerCase() === "quarterly")
                    .map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Action Steps</Label>
            <Textarea value={actionLines} onChange={(event) => setActionLines(event.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
