"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormFieldGroup } from "@/components/ui/patterns"
import type { User } from "../_lib/queries"

interface AddUserToRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleFilter: string
  userToAdd: string
  onUserSelect: (userId: string) => void
  availableUsers: User[]
  addUserWarning: string | null
  onConfirm: () => void
}

export function AddUserToRoleDialog({
  open,
  onOpenChange,
  roleFilter,
  userToAdd,
  onUserSelect,
  availableUsers,
  addUserWarning,
  onConfirm,
}: AddUserToRoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add User to {roleFilter.replace("_", " ")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <FormFieldGroup label="Select User">
            <Select value={userToAdd} onValueChange={onUserSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Search or select a user..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}` : u.email} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldGroup>
          {addUserWarning && (
            <div className="rounded-md bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
              {addUserWarning}
            </div>
          )}
          <div className="text-muted-foreground text-xs">Note: Users can only have one role at a time.</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!userToAdd}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
