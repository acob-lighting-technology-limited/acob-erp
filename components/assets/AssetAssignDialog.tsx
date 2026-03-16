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
import { SearchableSelect } from "@/components/ui/searchable-select"
import { formatName } from "@/lib/utils"
import { ASSET_TYPE_MAP } from "@/lib/asset-types"
import { OFFICE_LOCATIONS } from "@/lib/permissions"
import { User, Building2, Building } from "lucide-react"
import type { Asset, Employee } from "@/app/admin/assets/admin-assets-content"

interface AssetAssignment {
  id: string
  assigned_to?: string
  department?: string
  office_location?: string
  assignment_type?: string
  assigned_at: string
  is_current: boolean
  user?: {
    first_name: string
    last_name: string
  }
}

interface AssignFormState {
  assignment_type: "individual" | "department" | "office"
  assigned_to: string
  department: string
  office_location: string
  assignment_notes: string
  assigned_by: string
  assigned_at: string
}

interface AssetAssignDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedAsset: Asset | null
  assignForm: AssignFormState
  setAssignForm: (form: AssignFormState) => void
  currentAssignment: AssetAssignment | null
  onAssign: () => void
  employees: Employee[]
  activeEmployees: Employee[]
  departments: string[]
  isAssigning: boolean
}

export function AssetAssignDialog({
  isOpen,
  onOpenChange,
  selectedAsset,
  assignForm,
  setAssignForm,
  currentAssignment,
  onAssign,
  employees,
  activeEmployees,
  departments,
  isAssigning,
}: AssetAssignDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentAssignment ? "Reassign" : "Assign"} Asset</DialogTitle>
          <DialogDescription>
            {currentAssignment ? "Reassign" : "Assign"} {selectedAsset?.unique_code} (
            {ASSET_TYPE_MAP[selectedAsset?.asset_type || ""]?.label})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!currentAssignment && selectedAsset?.status !== "assigned" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">New Assignment</p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                When you assign this asset, its status will automatically be changed to &quot;assigned&quot;
              </p>
            </div>
          )}
          {currentAssignment && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                Currently assigned to:{" "}
                {selectedAsset?.assignment_type === "office" ? (
                  <span>{selectedAsset.office_location || "Office"}</span>
                ) : currentAssignment.department ? (
                  <span>{currentAssignment.department} (Department)</span>
                ) : currentAssignment.user ? (
                  <span>
                    {formatName((currentAssignment.user as any)?.first_name)}{" "}
                    {formatName((currentAssignment.user as any)?.last_name)}
                  </span>
                ) : (
                  "Unknown"
                )}
              </p>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                This assignment will be marked as handed over
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="assignment_type">Assignment Type *</Label>
            <SearchableSelect
              value={assignForm.assignment_type}
              onValueChange={(value) =>
                setAssignForm({
                  ...assignForm,
                  assignment_type: value as "individual" | "department" | "office",
                  assigned_to: "",
                  department: "",
                  office_location: "",
                })
              }
              placeholder="Select assignment type"
              searchPlaceholder="Search assignment types..."
              options={[
                { value: "individual", label: "Individual Assignment", icon: <User className="h-3 w-3" /> },
                { value: "department", label: "Department Assignment", icon: <Building2 className="h-3 w-3" /> },
                { value: "office", label: "Office/Room Assignment", icon: <Building className="h-3 w-3" /> },
              ]}
            />
          </div>

          {assignForm.assignment_type === "individual" && (
            <div>
              <Label htmlFor="assigned_to">Assign To *</Label>
              <SearchableSelect
                value={assignForm.assigned_to}
                onValueChange={(value) => setAssignForm({ ...assignForm, assigned_to: value })}
                placeholder="Select employees member"
                searchPlaceholder="Search employees..."
                icon={<User className="h-4 w-4" />}
                options={activeEmployees.map((member) => ({
                  value: member.id,
                  label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                  icon: <User className="h-3 w-3" />,
                }))}
              />
              <p className="text-muted-foreground mt-1 text-xs">{employees.length} employees members available</p>
            </div>
          )}

          {assignForm.assignment_type === "department" && (
            <div>
              <Label htmlFor="department">Department *</Label>
              <SearchableSelect
                value={assignForm.department}
                onValueChange={(value) => setAssignForm({ ...assignForm, department: value })}
                placeholder="Select department"
                searchPlaceholder="Search departments..."
                icon={<Building2 className="h-4 w-4" />}
                options={departments.map((dept) => ({
                  value: dept,
                  label: dept,
                  icon: <Building2 className="h-3 w-3" />,
                }))}
              />
              <p className="text-muted-foreground mt-1 text-xs">{departments.length} departments available</p>
            </div>
          )}

          {assignForm.assignment_type === "office" && (
            <div>
              <Label htmlFor="office_location">Office Location *</Label>
              <SearchableSelect
                value={assignForm.office_location}
                onValueChange={(value) => setAssignForm({ ...assignForm, office_location: value })}
                placeholder="Select office location"
                searchPlaceholder="Search office locations..."
                icon={<Building className="h-4 w-4" />}
                options={OFFICE_LOCATIONS.map((location) => ({
                  value: location,
                  label: location,
                  icon: <Building className="h-3 w-3" />,
                }))}
              />
              <p className="text-muted-foreground mt-1 text-xs">{OFFICE_LOCATIONS.length} office locations available</p>
            </div>
          )}

          {/* Added: Manual Override for Assigned By & At */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="assigned_by">Assigned By (Optional Override)</Label>
              <SearchableSelect
                value={assignForm.assigned_by}
                onValueChange={(value) => setAssignForm({ ...assignForm, assigned_by: value })}
                placeholder="Select assigner (defaults to you)"
                searchPlaceholder="Search employees..."
                icon={<User className="h-4 w-4" />}
                options={activeEmployees.map((employee) => ({
                  value: employee.id,
                  label: `${formatName(employee.last_name)}, ${formatName(employee.first_name)}`,
                  secondaryLabel: employee.department,
                  icon: <User className="h-3 w-3" />,
                }))}
              />
            </div>
            <div>
              <Label htmlFor="assigned_at">Assigned Date (Optional Override)</Label>
              <Input
                type="datetime-local"
                id="assigned_at"
                value={assignForm.assigned_at || ""}
                onChange={(e) => setAssignForm({ ...assignForm, assigned_at: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="assignment_notes">Assignment Notes</Label>
            <Textarea
              id="assignment_notes"
              value={assignForm.assignment_notes}
              onChange={(e) => setAssignForm({ ...assignForm, assignment_notes: e.target.value })}
              placeholder="Any notes about this assignment (e.g., faults, accessories included)..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAssigning}>
            Cancel
          </Button>
          <Button
            onClick={onAssign}
            loading={isAssigning}
            disabled={
              (assignForm.assignment_type === "individual" && !assignForm.assigned_to) ||
              (assignForm.assignment_type === "department" && !assignForm.department) ||
              (assignForm.assignment_type === "office" && !assignForm.office_location)
            }
          >
            {currentAssignment ? "Reassign Asset" : "Assign Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
