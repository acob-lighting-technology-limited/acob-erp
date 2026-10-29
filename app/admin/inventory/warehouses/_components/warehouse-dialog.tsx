"use client"

import type { Dispatch, SetStateAction } from "react"
import type { WarehouseData } from "../page-client"
import { Plus, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { FormFieldGroup } from "@/components/ui/patterns"

interface WarehouseDialogProps {
  isDialogOpen: boolean
  setIsDialogOpen: Dispatch<SetStateAction<boolean>>
  openCreate: () => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  editing: WarehouseData | null
  formData: { name: string; code: string; address: string; is_active: boolean }
  setFormData: Dispatch<SetStateAction<{ name: string; code: string; address: string; is_active: boolean }>>
}

export function WarehouseDialog({
  isDialogOpen,
  setIsDialogOpen,
  openCreate,
  handleSubmit,
  editing,
  formData,
  setFormData,
}: WarehouseDialogProps) {
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Warehouse</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} Warehouse</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Name">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  required
                />
              </FormFieldGroup>
              <FormFieldGroup label="Code">
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(event) => setFormData({ ...formData, code: event.target.value })}
                  placeholder="e.g. WH-001"
                  required
                />
              </FormFieldGroup>
            </div>
            <FormFieldGroup label="Address">
              <Textarea
                id="address"
                value={formData.address}
                onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                rows={3}
              />
            </FormFieldGroup>
            <FormFieldGroup label="Active">
              <div className="flex items-center justify-end">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </FormFieldGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
