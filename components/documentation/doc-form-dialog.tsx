"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Save, EyeOff } from "lucide-react"

const CATEGORIES = [
  "Project Documentation",
  "Meeting Notes",
  "Process Documentation",
  "Technical Guides",
  "Reports",
  "Training Materials",
  "Other",
]

export interface DocFormData {
  title: string
  content: string
  category: string
  tags: string
  is_draft: boolean
}

interface DocFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isEditing: boolean
  formData: DocFormData
  onFormChange: (data: DocFormData) => void
  onSave: (isDraft: boolean) => void
  isSaving: boolean
}

export function DocFormDialog({
  open,
  onOpenChange,
  isEditing,
  formData,
  onFormChange,
  onSave,
  isSaving,
}: DocFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Document" : "Create New Document"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update your documentation" : "Create a new work document"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={formData.title}
              onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
              placeholder="Document title..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={formData.category}
                onValueChange={(value) => onFormChange({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags (comma separated)</label>
              <Input
                value={formData.tags}
                onChange={(e) => onFormChange({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content *</label>
            <Textarea
              value={formData.content}
              onChange={(e) => onFormChange({ ...formData, content: e.target.value })}
              placeholder="Write your documentation here..."
              className="min-h-[300px] text-base"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => onSave(true)} disabled={isSaving} className="gap-2">
            <EyeOff className="h-4 w-4" />
            Save as Draft
          </Button>
          <Button onClick={() => onSave(false)} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
