"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { Plus } from "lucide-react"
import { useDepartments } from "@/hooks/use-departments"
import type { UserRole } from "@/types/database"
import { getRoleDisplayName } from "@/lib/permissions"
import { getAssignableRolesForActor } from "@/lib/role-management"
import type { UserProfile } from "@/app/admin/hr/employees/admin-employee-content"

interface CreateUserForm {
  firstName: string
  lastName: string
  otherNames: string
  email: string
  department: string
  companyRole: string
  phoneNumber: string
  role: UserRole
  admin_domains: string[]
  employeeNumber: string
}

interface CreateUserDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  form: CreateUserForm
  setForm: (form: CreateUserForm) => void
  onCreate: () => void
  isCreating: boolean
  canManageUsers: boolean
  userProfile: UserProfile
}

export function CreateUserDialog({
  isOpen,
  onOpenChange,
  form,
  setForm,
  onCreate,
  isCreating,
  canManageUsers,
  userProfile,
}: CreateUserDialogProps) {
  const { departments: DEPARTMENTS } = useDepartments()

  const getAvailableRoles = (): UserRole[] => {
    if (!userProfile) return []
    return getAssignableRolesForActor(userProfile.role) as UserRole[]
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="space-y-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Plus className="text-primary h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Create New User</DialogTitle>
              <DialogDescription className="mt-1">
                Add a new employees member to the system. Name, email, and department are required.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="create_first_name">
                First Name * <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create_first_name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="John"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="create_last_name">
                Last Name * <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create_last_name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Doe"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="create_other_names">Other Names</Label>
            <Input
              id="create_other_names"
              value={form.otherNames}
              onChange={(e) => setForm({ ...form, otherNames: e.target.value })}
              placeholder="Middle name or other names (optional)"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="create_employee_number">
              Employee Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create_employee_number"
              value={form.employeeNumber}
              onChange={(e) => setForm({ ...form, employeeNumber: e.target.value.toUpperCase() })}
              placeholder="e.g., ACOB/2026/058"
              className="mt-1.5 font-mono"
              required
            />
            <p className="text-muted-foreground mt-1 text-xs">Format: ACOB/YEAR/NUMBER (e.g., ACOB/2026/058)</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="create_email">
                Email * <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create_email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john.doe@company.com"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="create_phone">Phone Number</Label>
              <Input
                id="create_phone"
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="+234 800 000 0000"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="create_department">
                Department * <span className="text-destructive">*</span>
              </Label>
              <Select value={form.department} onValueChange={(value) => setForm({ ...form, department: value })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create_role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value: UserRole) =>
                  setForm({
                    ...form,
                    role: value,
                    admin_domains: value === "admin" ? form.admin_domains : [],
                  })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.role === "admin" && (
            <div>
              <Label>Admin Domains *</Label>
              <SearchableMultiSelect
                label="Admin Domains"
                values={form.admin_domains}
                onChange={(values) => setForm({ ...form, admin_domains: values })}
                options={[
                  { value: "hr", label: "HR" },
                  { value: "finance", label: "Finance" },
                  { value: "assets", label: "Assets" },
                  { value: "reports", label: "Reports" },
                  { value: "tasks", label: "Tasks" },
                  { value: "projects", label: "Projects" },
                  { value: "communications", label: "Communications" },
                ]}
                placeholder="Select at least one admin domain"
              />
              <p className="text-muted-foreground mt-1 text-xs">Admin must have one or more domains.</p>
            </div>
          )}

          <div>
            <Label htmlFor="create_company_role">Position/Title</Label>
            <Input
              id="create_company_role"
              value={form.companyRole}
              onChange={(e) => setForm({ ...form, companyRole: e.target.value })}
              placeholder="e.g., Senior Developer, Manager"
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={onCreate}
            disabled={
              isCreating || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.department
            }
            className="gap-2"
          >
            {isCreating ? (
              "Creating..."
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
