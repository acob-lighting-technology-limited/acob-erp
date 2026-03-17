"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface ItemForm {
  item_name: string
  description: string
  quantity: string
  unit: string
  status: string
  notes: string
}

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isEditing: boolean
  form: ItemForm
  onFormChange: (form: ItemForm) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function ItemDialog({
  open,
  onOpenChange,
  isEditing,
  form,
  onFormChange,
  onSubmit,
  isSubmitting,
}: ItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Item" : "Add Item"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update item details" : "Add a new item to this project"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item_name">Item Name</Label>
            <Input
              id="item_name"
              value={form.item_name}
              onChange={(e) => onFormChange({ ...form, item_name: e.target.value })}
              placeholder="Enter item name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              placeholder="Enter item description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={form.quantity}
                onChange={(e) => onFormChange({ ...form, quantity: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => onFormChange({ ...form, unit: e.target.value })}
                placeholder="e.g., pieces, units"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(value) => onFormChange({ ...form, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Additional notes"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isSubmitting}>
            {isEditing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
