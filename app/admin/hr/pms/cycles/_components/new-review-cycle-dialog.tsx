"use client"

import type { Dispatch, SetStateAction } from "react"
import type { CycleStatus } from "../view"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface NewReviewCycleDialogProps {
  isCreateOpen: boolean
  setIsCreateOpen: Dispatch<SetStateAction<boolean>>
  handleCreate: (event: React.FormEvent) => Promise<void>
  name: string
  setName: Dispatch<SetStateAction<string>>
  reviewType: string
  setReviewType: Dispatch<SetStateAction<string>>
  startDate: string
  setStartDate: Dispatch<SetStateAction<string>>
  endDate: string
  setEndDate: Dispatch<SetStateAction<string>>
  status: CycleStatus
  setStatus: Dispatch<SetStateAction<CycleStatus>>
  resetForm: () => void
  isSubmitting: boolean
}

export function NewReviewCycleDialog({
  isCreateOpen,
  setIsCreateOpen,
  handleCreate,
  name,
  setName,
  reviewType,
  setReviewType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  status,
  setStatus,
  resetForm,
  isSubmitting,
}: NewReviewCycleDialogProps) {
  return (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Review Cycle</DialogTitle>
          <DialogDescription>Define a new performance review period.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <div className="space-y-2">
            <Label>Cycle Name *</Label>
            <Input
              placeholder="e.g. Q1 2026 Performance Review"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Review Type *</Label>
            <Select value={reviewType} onValueChange={setReviewType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="mid_year">Mid-Year</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Initial Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as CycleStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="active">Active (starts immediately)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                resetForm()
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Cycle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
