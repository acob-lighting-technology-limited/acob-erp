"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"

export interface RoleFormData {
  name: string
  description: string
  permissions: string[]
}

export interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  user_count?: number
  is_system: boolean
  created_at: string
}

const defaultPermissions = [
  { key: "users.view", label: "View Users" },
  { key: "users.manage", label: "Manage Users" },
  { key: "roles.manage", label: "Manage Roles" },
  { key: "hr.view", label: "View HR Data" },
  { key: "hr.manage", label: "Manage HR" },
  { key: "finance.view", label: "View Finance" },
  { key: "finance.manage", label: "Manage Finance" },
  { key: "inventory.view", label: "View Inventory" },
  { key: "inventory.manage", label: "Manage Inventory" },
  { key: "purchasing.view", label: "View Purchasing" },
  { key: "purchasing.manage", label: "Manage Purchasing" },
  { key: "settings.manage", label: "Manage Settings" },
  { key: "reports.view", label: "View Reports" },
]

interface RoleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRole: Role | null
  formData: RoleFormData
  onFormDataChange: (data: RoleFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onOpenCreate: () => void
}

export function RoleFormDialog({
  open,
  onOpenChange,
  editingRole,
  formData,
  onFormDataChange,
  onSubmit,
  onOpenCreate,
}: RoleFormDialogProps) {
  function togglePermission(key: string) {
    onFormDataChange({
      ...formData,
      permissions: formData.permissions.includes(key)
        ? formData.permissions.filter((p) => p !== key)
        : [...formData.permissions, key],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit" : "Create"} Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                placeholder="e.g., accountant"
                required
                disabled={editingRole?.is_system}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {defaultPermissions.map((perm) => (
                  <div key={perm.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={perm.key}
                      checked={formData.permissions.includes(perm.key)}
                      onCheckedChange={() => togglePermission(perm.key)}
                    />
                    <label htmlFor={perm.key} className="cursor-pointer text-sm">
                      {perm.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingRole ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
