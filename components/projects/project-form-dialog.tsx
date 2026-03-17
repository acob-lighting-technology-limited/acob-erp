"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { User } from "lucide-react"
import type { employee } from "@/app/admin/projects/page"

export interface ProjectFormState {
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w: string
  technology_type: string
  project_manager_id: string
  description: string
  status: string
}

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isEditing: boolean
  form: ProjectFormState
  onFormChange: (form: ProjectFormState) => void
  onSave: () => void
  isSaving: boolean
  activeEmployees: employee[]
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  isEditing,
  form,
  onFormChange,
  onSave,
  isSaving,
  activeEmployees,
}: ProjectFormDialogProps) {
  const set = (patch: Partial<ProjectFormState>) => onFormChange({ ...form, ...patch })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Project" : "Create New Project"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update project details below"
              : "Fill in the project information. Fields marked with * are required."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project_name">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project_name"
              value={form.project_name}
              onChange={(e) => set({ project_name: e.target.value })}
              placeholder="Enter project name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">
              Location <span className="text-red-500">*</span>
            </Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="Enter project location"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deployment_start_date">
                Deployment Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deployment_start_date"
                type="date"
                value={form.deployment_start_date}
                onChange={(e) => set({ deployment_start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deployment_end_date">
                Deployment End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deployment_end_date"
                type="date"
                min={form.deployment_start_date}
                value={form.deployment_end_date}
                onChange={(e) => set({ deployment_end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity_w">Capacity (W)</Label>
              <Input
                id="capacity_w"
                type="number"
                value={form.capacity_w}
                onChange={(e) => set({ capacity_w: e.target.value })}
                placeholder="Enter capacity in watts"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="technology_type">Technology Type</Label>
              <Input
                id="technology_type"
                value={form.technology_type}
                onChange={(e) => set({ technology_type: e.target.value })}
                placeholder="e.g., Solar, Wind, Hybrid"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_manager_id">Project Manager</Label>
            <SearchableSelect
              value={form.project_manager_id || "none"}
              onValueChange={(value) => set({ project_manager_id: value === "none" ? "" : value })}
              placeholder="Select project manager"
              searchPlaceholder="Search employee..."
              icon={<User className="h-4 w-4" />}
              options={[
                { value: "none", label: "None" },
                ...activeEmployees.map((member) => ({
                  value: member.id,
                  label: `${member.first_name} ${member.last_name} - ${member.department}`,
                })),
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(value) => set({ status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Enter project description"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
