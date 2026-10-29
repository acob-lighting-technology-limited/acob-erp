"use client"

import type { Dispatch, SetStateAction } from "react"
import type { CompetencyCategory } from "../view"
import { Plus } from "lucide-react"
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

interface AddCompetencyDialogProps {
  isCreateOpen: boolean
  setIsCreateOpen: Dispatch<SetStateAction<boolean>>
  handleCreate: (event: React.FormEvent) => Promise<void>
  key: string
  setKey: Dispatch<SetStateAction<string>>
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

export function AddCompetencyDialog({
  isCreateOpen,
  setIsCreateOpen,
  handleCreate,
  key,
  setKey,
  label,
  setLabel,
  category,
  setCategory,
  sortOrder,
  setSortOrder,
  description,
  setDescription,
  isSubmitting,
}: AddCompetencyDialogProps) {
  return (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Competency</DialogTitle>
          <DialogDescription>Define a new competency that appears as a scoring field on reviews.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Key *</Label>
              <Input
                placeholder="e.g. problem_solving"
                value={key}
                onChange={(event) => setKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                required
              />
            </div>
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
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Plus className="h-4 w-4" />
              {isSubmitting ? "Saving..." : "Add Competency"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
