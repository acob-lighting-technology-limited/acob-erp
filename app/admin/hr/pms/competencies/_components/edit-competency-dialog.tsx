"use client"

import type { Dispatch, SetStateAction } from "react"
import type { CompetencyCategory } from "../view"
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

interface EditCompetencyDialogProps {
  isEditOpen: boolean
  setIsEditOpen: Dispatch<SetStateAction<boolean>>
  handleEdit: (event: React.FormEvent) => Promise<void>
  label: string
  setLabel: Dispatch<SetStateAction<string>>
  category: CompetencyCategory
  setCategory: Dispatch<SetStateAction<CompetencyCategory>>
  sortOrder: string
  setSortOrder: Dispatch<SetStateAction<string>>
  description: string
  setDescription: Dispatch<SetStateAction<string>>
  isSubmitting: boolean
}

export function EditCompetencyDialog({
  isEditOpen,
  setIsEditOpen,
  handleEdit,
  label,
  setLabel,
  category,
  setCategory,
  sortOrder,
  setSortOrder,
  description,
  setDescription,
  isSubmitting,
}: EditCompetencyDialogProps) {
  return (
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Competency</DialogTitle>
          <DialogDescription>Update the label, category, and description for this scoring field.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleEdit(event)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as CompetencyCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="behaviour">Behaviour</SelectItem>
                  <SelectItem value="leadership">Leadership</SelectItem>
                  <SelectItem value="core">Core</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
