"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { FormFieldGroup } from "@/components/ui/patterns"
import { User } from "lucide-react"

interface Employee {
  id: string
  first_name: string
  last_name: string
  department: string
}

export interface MemberForm {
  user_id: string
  role: string
}

interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableEmployees: Employee[]
  form: MemberForm
  onFormChange: (form: MemberForm) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function AddMemberDialog({
  open,
  onOpenChange,
  availableEmployees,
  form,
  onFormChange,
  onSubmit,
  isSubmitting,
}: AddMemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Project Member</DialogTitle>
          <DialogDescription>Assign a employee member to this project</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user_id">employee Member</Label>
            <SearchableSelect
              value={form.user_id}
              onValueChange={(value) => onFormChange({ ...form, user_id: value })}
              placeholder="Select employee member"
              searchPlaceholder="Search employee..."
              icon={<User className="h-4 w-4" />}
              options={availableEmployees.map((member) => ({
                value: member.id,
                label: `${member.first_name} ${member.last_name} - ${member.department}`,
              }))}
            />
          </div>

          <FormFieldGroup label="Role">
            <Select value={form.role} onValueChange={(value) => onFormChange({ ...form, role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </FormFieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isSubmitting}>
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
