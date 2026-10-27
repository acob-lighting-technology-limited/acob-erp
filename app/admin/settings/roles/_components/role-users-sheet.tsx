"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/ui/patterns"
import { Plus, Users } from "lucide-react"
import { formatDDMMYYYY } from "@/lib/utils/date"

export interface RoleMember {
  id: string
  first_name: string | null
  last_name: string | null
  company_email: string | null
  department: string | null
  employment_status: string | null
  employment_date?: string | null
  created_at: string
}

interface RoleUsersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRoleName: string
  roleUsers: RoleMember[]
  roleUsersLoading: boolean
  isAddUserInlineOpen: boolean
  onToggleAddUser: () => void
  availableUsers: RoleMember[]
  selectedUserId: string
  onUserSelect: (userId: string) => void
  addUserWarning: string | null
  addingUser: boolean
  onAddUserToRole: () => void
  onCancelAddUser: () => void
}

export function RoleUsersSheet({
  open,
  onOpenChange,
  selectedRoleName,
  roleUsers,
  roleUsersLoading,
  isAddUserInlineOpen,
  onToggleAddUser,
  availableUsers,
  selectedUserId,
  onUserSelect,
  addUserWarning,
  addingUser,
  onAddUserToRole,
  onCancelAddUser,
}: RoleUsersSheetProps) {
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${selectedRoleName.replace("_", " ")} users`}
      description="Users currently assigned this role."
      footer={
        selectedRoleName ? (
          <Button size="sm" className="ml-auto" onClick={onToggleAddUser}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        ) : undefined
      }
    >
      {isAddUserInlineOpen && (
        <div className="space-y-3 rounded-md border p-3">
          <Label>Select User</Label>
          <Select value={selectedUserId} onValueChange={onUserSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Search or select a user..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.first_name || u.last_name
                    ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                    : u.company_email || "Unnamed user"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {addUserWarning && <p className="text-muted-foreground text-xs">{addUserWarning}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancelAddUser}>
              Cancel
            </Button>
            <Button onClick={onAddUserToRole} disabled={!selectedUserId || addingUser}>
              {addingUser ? "Adding..." : "Confirm"}
            </Button>
          </div>
        </div>
      )}

      {roleUsersLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
        </div>
      ) : roleUsers.length === 0 ? (
        <EmptyState title="No users in this role" icon={Users} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {roleUsers.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.first_name || member.last_name
                    ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
                    : "—"}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {member.company_email || "—"} · {member.department || "No department"}
                </p>
                <p className="text-muted-foreground text-xs">
                  Employed {formatDDMMYYYY(member.employment_date) || "—"} · Onboarded{" "}
                  {formatDDMMYYYY(member.created_at) || "—"}
                </p>
              </div>
              <Badge variant={member.employment_status === "active" ? "default" : "secondary"}>
                {member.employment_status || "unknown"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </DetailSheet>
  )
}
