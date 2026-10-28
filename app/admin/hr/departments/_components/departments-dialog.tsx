"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Department } from "../view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Plus } from "lucide-react"

interface DepartmentsDialogProps {
  isDialogOpen: boolean
  setIsDialogOpen: Dispatch<SetStateAction<boolean>>
  openCreateDialog: () => void
  handleSubmit: (event: React.FormEvent) => Promise<void>
  editingDepartment: Department | null
  formData: {
    name: string
    description: string
    department_code: string
    email: string
    is_executive_dept: boolean
    is_active: boolean
  }
  setFormData: Dispatch<
    SetStateAction<{
      name: string
      description: string
      department_code: string
      email: string
      is_executive_dept: boolean
      is_active: boolean
    }>
  >
  originalCode: string | null
  existingReferenceCount: number
  saving: boolean
}

export function DepartmentsDialog({
  isDialogOpen,
  setIsDialogOpen,
  openCreateDialog,
  handleSubmit,
  editingDepartment,
  formData,
  setFormData,
  originalCode,
  existingReferenceCount,
  saving,
}: DepartmentsDialogProps) {
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={openCreateDialog} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Department</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Edit Department" : "Create Department"}</DialogTitle>
            <DialogDescription>
              {editingDepartment
                ? "Update the department details below."
                : "Add a new department to your organization."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Department Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="e.g., Engineering, Sales, Marketing"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department_code">Department Code</Label>
              <Input
                id="department_code"
                value={formData.department_code}
                onChange={(event) => setFormData({ ...formData, department_code: event.target.value.toUpperCase() })}
                placeholder="e.g. HR, IT, OPS"
                maxLength={10}
              />
              <p className="text-muted-foreground text-xs">
                2–10 characters. Used to generate correspondence reference numbers. Changing the department name does{" "}
                <strong>not</strong> affect this code or existing references.
              </p>
              {editingDepartment && originalCode && formData.department_code.trim().toUpperCase() !== originalCode && (
                <div className="border-warning/30 bg-warning/15 text-warning flex gap-2 rounded-md border p-3 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">Code change — reference counter will restart</p>
                    <p>
                      {existingReferenceCount > 0
                        ? `${existingReferenceCount} existing reference${existingReferenceCount === 1 ? "" : "s"} use code `
                        : "No existing references use code "}
                      <code className="font-mono font-bold">{originalCode}</code>
                      {existingReferenceCount > 0 ? " and will keep that code permanently." : "."}
                    </p>
                    <p>
                      New references will use{" "}
                      <code className="font-mono font-bold">
                        {formData.department_code.trim().toUpperCase() || "…"}
                      </code>{" "}
                      and the sequence counter starts fresh at <code className="font-mono font-bold">001</code>.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department_email">Official Department Email</Label>
              <Input
                id="department_email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                placeholder="e.g. ict@acoblighting.com"
              />
              <p className="text-muted-foreground text-xs">Official inbox/contact address for this department.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                placeholder="Brief description of the department responsibilities..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="is_executive_dept">Final Approver Department</Label>
                <p className="text-muted-foreground text-xs">
                  This department&apos;s lead is the final approver on all correspondence. Only one department can hold
                  this role — enabling it here will remove it from any other department.
                </p>
              </div>
              <Switch
                id="is_executive_dept"
                checked={formData.is_executive_dept}
                onCheckedChange={(checked) => setFormData({ ...formData, is_executive_dept: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingDepartment ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
