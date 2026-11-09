"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"

interface CreatePayrollPeriodDialogProps {
  openPeriod: boolean
  setOpenPeriod: Dispatch<SetStateAction<boolean>>
  handleCreatePeriod: (e: React.FormEvent) => Promise<void>
  periodForm: { name: string; start_date: string; end_date: string; pay_date: string }
  setPeriodForm: Dispatch<SetStateAction<{ name: string; start_date: string; end_date: string; pay_date: string }>>
  loading: boolean
}

export function CreatePayrollPeriodDialog({
  openPeriod,
  setOpenPeriod,
  handleCreatePeriod,
  periodForm,
  setPeriodForm,
  loading,
}: CreatePayrollPeriodDialogProps) {
  return (
    <Dialog open={openPeriod} onOpenChange={setOpenPeriod}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Create Period
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleCreatePeriod}>
          <DialogHeader>
            <DialogTitle>Create Payroll Period</DialogTitle>
            <DialogDescription>Set up a monthly cycle dates configuration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Period Name</Label>
              <Input
                id="name"
                placeholder="e.g. June 2026"
                value={periodForm.name}
                onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={periodForm.start_date}
                  onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={periodForm.end_date}
                  onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay_date">Target Pay Date</Label>
              <Input
                id="pay_date"
                type="date"
                value={periodForm.pay_date}
                onChange={(e) => setPeriodForm({ ...periodForm, pay_date: e.target.value })}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenPeriod(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
