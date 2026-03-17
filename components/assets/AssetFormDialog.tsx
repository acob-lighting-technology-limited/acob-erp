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
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { OFFICE_LOCATIONS } from "@/lib/permissions"
import { generateUniqueCodePreview } from "@/lib/asset-types"
import { Plus, User, Building2, Building } from "lucide-react"
import type { Asset, Employee } from "@/app/admin/assets/admin-assets-content"

const currentYear = new Date().getFullYear()

interface AssetFormState {
  asset_type: string
  acquisition_year: number
  asset_model: string
  serial_number: string
  unique_code: string
  status: string
  notes: string
  assignment_type: "individual" | "department" | "office"
  assigned_to: string
  assignment_department: string
  office_location: string
  assignment_notes: string
  assigned_by: string
  assigned_at: string
}

interface AssetFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedAsset: Asset | null
  assetForm: AssetFormState
  setAssetForm: (form: AssetFormState) => void
  originalAssetForm: AssetFormState
  assetTypes: { label: string; code: string; requiresSerialModel: boolean }[]
  employees: Employee[]
  activeEmployees: Employee[]
  departments: string[]
  offices?: string[]
  onSave: () => void
  isSaving: boolean
  canCreateAssetType: boolean
  onOpenCreateAssetType: () => void
  batchQuantity: number
  setBatchQuantity: (qty: number) => void
}

export function AssetFormDialog({
  isOpen,
  onOpenChange,
  selectedAsset,
  assetForm,
  setAssetForm,
  originalAssetForm,
  assetTypes,
  employees: _employees,
  activeEmployees,
  departments,
  onSave,
  isSaving,
  canCreateAssetType,
  onOpenCreateAssetType,
  batchQuantity,
  setBatchQuantity,
}: AssetFormDialogProps) {
  const getUniqueCodePreview = () => {
    if (!assetForm.asset_type || !assetForm.acquisition_year) {
      return "ACOB/HQ/???/????/???"
    }
    return generateUniqueCodePreview(assetForm.asset_type, assetForm.acquisition_year, "???")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selectedAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
          <DialogDescription>
            {selectedAsset ? "Update the asset information below" : "Enter the details for the new asset"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="asset_type">Asset Type *</Label>
                {!selectedAsset && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!canCreateAssetType) {
                        toast.error("You do not have permission to create asset types")
                        return
                      }
                      onOpenCreateAssetType()
                    }}
                    disabled={!canCreateAssetType}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create New
                  </Button>
                )}
              </div>
              <SearchableSelect
                value={assetForm.asset_type}
                onValueChange={(value) => setAssetForm({ ...assetForm, asset_type: value })}
                placeholder="Select asset type"
                searchPlaceholder="Search asset types..."
                disabled={!!selectedAsset}
                options={assetTypes.map((type) => ({
                  value: type.code,
                  label: type.label,
                }))}
              />
              {selectedAsset && (
                <p className="text-muted-foreground mt-1 text-xs">Asset type cannot be changed after creation</p>
              )}
            </div>
            <div>
              <Label htmlFor="acquisition_year">Acquisition Year *</Label>
              <Input
                id="acquisition_year"
                type="number"
                min={2000}
                max={currentYear + 1}
                value={assetForm.acquisition_year}
                onChange={(e) =>
                  setAssetForm({ ...assetForm, acquisition_year: parseInt(e.target.value) || currentYear })
                }
                disabled={!!selectedAsset}
              />
              {selectedAsset && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Year cannot be changed after creation (it&apos;s part of the unique code)
                </p>
              )}
            </div>
            {!selectedAsset && (
              <div>
                <Label htmlFor="asset_quantity">Quantity *</Label>
                <Input
                  id="asset_quantity"
                  type="number"
                  min={1}
                  max={100}
                  value={batchQuantity}
                  onChange={(e) => setBatchQuantity(Math.max(1, parseInt(e.target.value || "1", 10) || 1))}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Create multiple assets with the same type and year in one batch (max 100)
                </p>
              </div>
            )}
          </div>

          {/* Unique Code Preview */}
          <div>
            <Label htmlFor="unique_code">Unique Code</Label>
            <Input
              id="unique_code"
              value={selectedAsset ? assetForm.unique_code : getUniqueCodePreview()}
              readOnly
              className="bg-muted font-mono text-sm"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {selectedAsset
                ? "Asset unique code (auto-generated at creation)"
                : "Preview - Serial number (001, 002...) is unique across all years for this asset type"}
            </p>
          </div>

          {/* Model and Serial Number fields - optional */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="asset_model">Asset Model (Optional)</Label>
              <Input
                id="asset_model"
                value={assetForm.asset_model}
                onChange={(e) => setAssetForm({ ...assetForm, asset_model: e.target.value })}
                placeholder="e.g., Dell Latitude 5420"
              />
              <p className="text-muted-foreground mt-1 text-xs">Can be added later if not available now</p>
            </div>
            <div>
              <Label htmlFor="serial_number">Serial Number (Optional)</Label>
              <Input
                id="serial_number"
                value={assetForm.serial_number}
                onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                placeholder="e.g., ABC123XYZ"
              />
              <p className="text-muted-foreground mt-1 text-xs">Can be added later if not available now</p>
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <SearchableSelect
              value={assetForm.status}
              onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}
              placeholder="Select status"
              searchPlaceholder="Search status..."
              options={[
                { value: "available", label: "Available" },
                { value: "assigned", label: "Assigned" },
                { value: "maintenance", label: "Maintenance" },
                { value: "retired", label: "Retired" },
              ]}
            />
          </div>

          {/* Assignment section - show ONLY when status is 'assigned' */}
          {assetForm.status === "assigned" && (
            <div className="space-y-4 border-t pt-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="bg-primary h-8 w-1 rounded" />
                <h4 className="text-foreground font-semibold">Assignment Details</h4>
              </div>

              <div>
                <Label htmlFor="assignment_type">Assignment Type *</Label>
                <SearchableSelect
                  value={assetForm.assignment_type}
                  onValueChange={(value) =>
                    setAssetForm({
                      ...assetForm,
                      assignment_type: value as "individual" | "department" | "office",
                      assigned_to: "",
                      assignment_department: "",
                      office_location: "",
                    })
                  }
                  placeholder="Select assignment type"
                  searchPlaceholder="Search assignment types..."
                  options={[
                    { value: "individual", label: "Individual Assignment" },
                    { value: "department", label: "Department Assignment" },
                    { value: "office", label: "Office/Room Assignment" },
                  ]}
                />
              </div>

              {assetForm.assignment_type === "individual" && (
                <div>
                  <Label htmlFor="assigned_to">Assign To *</Label>
                  <SearchableSelect
                    value={assetForm.assigned_to}
                    onValueChange={(value) => setAssetForm({ ...assetForm, assigned_to: value })}
                    placeholder="Select employees member"
                    searchPlaceholder="Search employees..."
                    icon={<User className="h-4 w-4" />}
                    options={activeEmployees.map((member) => ({
                      value: member.id,
                      label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                      icon: <User className="h-3 w-3" />,
                    }))}
                  />
                </div>
              )}

              {assetForm.assignment_type === "department" && (
                <div>
                  <Label htmlFor="assignment_department">Department *</Label>
                  <SearchableSelect
                    value={assetForm.assignment_department}
                    onValueChange={(value) => setAssetForm({ ...assetForm, assignment_department: value })}
                    placeholder="Select department"
                    searchPlaceholder="Search departments..."
                    icon={<Building2 className="h-4 w-4" />}
                    options={departments.map((dept) => ({
                      value: dept,
                      label: dept,
                      icon: <Building2 className="h-3 w-3" />,
                    }))}
                  />
                </div>
              )}

              {assetForm.assignment_type === "office" && (
                <div>
                  <Label htmlFor="office_location">Office Location *</Label>
                  <SearchableSelect
                    value={assetForm.office_location}
                    onValueChange={(value) => setAssetForm({ ...assetForm, office_location: value })}
                    placeholder="Select office location"
                    searchPlaceholder="Search office locations..."
                    icon={<Building className="h-4 w-4" />}
                    options={OFFICE_LOCATIONS.map((location) => ({
                      value: location,
                      label: location,
                      icon: <Building className="h-3 w-3" />,
                    }))}
                  />
                </div>
              )}

              {/* Added: Manual Override for Assigned By & At */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="assigned_by">Assigned By (Optional Override)</Label>
                  <SearchableSelect
                    value={assetForm.assigned_by}
                    onValueChange={(value) => setAssetForm({ ...assetForm, assigned_by: value })}
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
                    value={assetForm.assigned_at || ""}
                    onChange={(e) => setAssetForm({ ...assetForm, assigned_at: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="assignment_notes">Assignment Notes (Optional)</Label>
                <Textarea
                  id="assignment_notes"
                  value={assetForm.assignment_notes}
                  onChange={(e) => setAssetForm({ ...assetForm, assignment_notes: e.target.value })}
                  placeholder="Notes about this assignment..."
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            loading={isSaving}
            disabled={
              // For both create and edit: asset_type is required
              !assetForm.asset_type ||
              // For edit: check if anything changed
              (selectedAsset
                ? assetForm.asset_type === originalAssetForm.asset_type &&
                  assetForm.acquisition_year === originalAssetForm.acquisition_year &&
                  assetForm.asset_model === originalAssetForm.asset_model &&
                  assetForm.serial_number === originalAssetForm.serial_number &&
                  assetForm.status === originalAssetForm.status &&
                  // Check assignment details
                  assetForm.assignment_type === originalAssetForm.assignment_type &&
                  assetForm.assigned_to === originalAssetForm.assigned_to &&
                  assetForm.assignment_department === originalAssetForm.assignment_department &&
                  assetForm.office_location === originalAssetForm.office_location &&
                  assetForm.assignment_notes === originalAssetForm.assignment_notes &&
                  assetForm.assigned_by === originalAssetForm.assigned_by &&
                  assetForm.assigned_at === originalAssetForm.assigned_at
                : false) ||
              // For create with "assigned" status: validate assignment fields (only when creating, not editing)
              (!selectedAsset && (!Number.isInteger(batchQuantity) || batchQuantity < 1 || batchQuantity > 100)) ||
              (!selectedAsset && batchQuantity > 1 && !!String(assetForm.serial_number || "").trim()) ||
              (!selectedAsset &&
                assetForm.status === "assigned" &&
                assetForm.assignment_type === "individual" &&
                !assetForm.assigned_to) ||
              (!selectedAsset &&
                assetForm.status === "assigned" &&
                assetForm.assignment_type === "department" &&
                !assetForm.assignment_department) ||
              (!selectedAsset &&
                assetForm.status === "assigned" &&
                assetForm.assignment_type === "office" &&
                !assetForm.office_location)
            }
          >
            {selectedAsset ? "Update Asset" : batchQuantity > 1 ? `Create ${batchQuantity} Assets` : "Create Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
