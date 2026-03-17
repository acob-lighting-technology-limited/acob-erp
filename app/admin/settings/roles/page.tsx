"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Shield, Users } from "lucide-react"
import { toast } from "sonner"
import { DepartmentLeadsManager } from "@/components/admin/department-leads-manager"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { ASSIGNABLE_ROLES } from "@/lib/role-management"
import { RoleFormDialog } from "./_components/role-form-dialog"
import { RoleUsersDialog } from "./_components/role-users-dialog"
import { RolesTable } from "./_components/roles-table"
import { DEFAULT_ROLES, fetchRolesData } from "./_components/roles-data"
import type { Role, RoleFormData } from "./_components/role-form-dialog"
import type { RoleMember } from "./_components/role-users-dialog"

import { logger } from "@/lib/logger"

const log = logger("settings-roles")

export default function RolesPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState<RoleFormData>({ name: "", description: "", permissions: [] })
  const [roleUsersOpen, setRoleUsersOpen] = useState(false)
  const [selectedRoleName, setSelectedRoleName] = useState<string>("")
  const [roleUsers, setRoleUsers] = useState<RoleMember[]>([])
  const [roleUsersLoading, setRoleUsersLoading] = useState(false)
  const [isAddUserInlineOpen, setIsAddUserInlineOpen] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<RoleMember[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [addUserWarning, setAddUserWarning] = useState<string | null>(null)
  const [addingUser, setAddingUser] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null)

  const { data: roles = DEFAULT_ROLES, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminRolesSettings(),
    queryFn: fetchRolesData,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const supabase = createClient()
      if (editingRole) {
        const { error } = await supabase
          .from("roles")
          .update({ name: formData.name, description: formData.description || null, permissions: formData.permissions })
          .eq("id", editingRole.id)
        if (error) throw error
        toast.success("Role updated")
      } else {
        const { error } = await supabase.from("roles").insert({
          name: formData.name,
          description: formData.description || null,
          permissions: formData.permissions,
          is_system: false,
        })
        if (error) throw error
        toast.success("Role created")
      }
      setIsDialogOpen(false)
      setEditingRole(null)
      setFormData({ name: "", description: "", permissions: [] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminRolesSettings() })
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message || "Failed to save")
    }
  }

  async function handleDelete(role: Role) {
    if (role.is_system) {
      toast.error("Cannot delete system roles")
      return
    }
    try {
      const supabase = createClient()
      const { error } = await supabase.from("roles").delete().eq("id", role.id)
      if (error) throw error
      toast.success("Deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminRolesSettings() })
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message)
    }
  }

  function openEdit(role: Role) {
    setEditingRole(role)
    setFormData({ name: role.name, description: role.description || "", permissions: role.permissions || [] })
    setIsDialogOpen(true)
  }

  function openCreate() {
    setEditingRole(null)
    setFormData({ name: "", description: "", permissions: [] })
    setIsDialogOpen(true)
  }

  async function openRoleUsers(roleName: string) {
    setSelectedRoleName(roleName)
    setRoleUsers([])
    setRoleUsersOpen(true)
    setRoleUsersLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, department, employment_status, created_at")
        .eq("role", roleName)
        .order("first_name", { ascending: true })
      if (error) throw error
      setRoleUsers((data || []) as RoleMember[])
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message || "Failed to load role users")
    } finally {
      setRoleUsersLoading(false)
    }
  }

  async function fetchAllUsersForRoleModal() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, department, employment_status, created_at")
        .order("first_name", { ascending: true })
      if (error) throw error
      setAvailableUsers((data || []) as RoleMember[])
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message || "Failed to load users")
    }
  }

  function handleUserSelect(userId: string) {
    setSelectedUserId(userId)
    const user = availableUsers.find((u) => u.id === userId)
    if (!user) return
    if (roleUsers.some((u) => u.id === userId)) {
      setAddUserWarning("This user already has this role.")
      return
    }
    setAddUserWarning(`User will be assigned to "${selectedRoleName.replace("_", " ")}".`)
  }

  async function handleAddUserToRole() {
    if (!selectedRoleName || !selectedUserId) return
    setAddingUser(true)
    try {
      const response = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedUserId, role: selectedRoleName }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to assign role")
      toast.success("User added to role")
      setSelectedUserId("")
      setAddUserWarning(null)
      setIsAddUserInlineOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminRolesSettings() })
      await openRoleUsers(selectedRoleName)
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.message || "Failed to add user")
    } finally {
      setAddingUser(false)
    }
  }

  const stats = {
    total: roles.filter((role) => !(role.is_system && !ASSIGNABLE_ROLES.includes(role.name as never))).length,
    system: roles.filter((role) => role.is_system && ASSIGNABLE_ROLES.includes(role.name as never)).length,
    custom: roles.filter((role) => !role.is_system).length,
  }

  const visibleRoles = roles.filter((role) => {
    if (role.is_system && !ASSIGNABLE_ROLES.includes(role.name as never)) return false
    return role.name !== "manager"
  })

  log.debug("Rendering roles page", { total: roles.length, visible: visibleRoles.length })

  return (
    <AdminTablePage
      title="Roles & Permissions"
      description="Configure access control for your organization."
      icon={Shield}
      backLinkHref="/admin/settings"
      backLinkLabel="Back to Settings"
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Total Roles" value={stats.total} icon={Shield} />
          <StatCard title="System Roles" value={stats.system} icon={Shield} />
          <StatCard title="Custom Roles" value={stats.custom} icon={Users} />
        </div>
      }
      actions={
        <RoleFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          editingRole={editingRole}
          formData={formData}
          onFormDataChange={setFormData}
          onSubmit={handleSubmit}
          onOpenCreate={openCreate}
        />
      }
    >
      <RolesTable
        roles={visibleRoles}
        loading={loading}
        onEdit={openEdit}
        onDelete={(role) => setPendingDelete(role)}
        onViewUsers={openRoleUsers}
      />

      <DepartmentLeadsManager />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `Delete role "${pendingDelete.name}"?` : "Are you sure?"} This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) handleDelete(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RoleUsersDialog
        open={roleUsersOpen}
        onOpenChange={setRoleUsersOpen}
        selectedRoleName={selectedRoleName}
        roleUsers={roleUsers}
        roleUsersLoading={roleUsersLoading}
        isAddUserInlineOpen={isAddUserInlineOpen}
        onToggleAddUser={async () => {
          setIsAddUserInlineOpen((prev) => !prev)
          if (!availableUsers.length) await fetchAllUsersForRoleModal()
        }}
        availableUsers={availableUsers}
        selectedUserId={selectedUserId}
        onUserSelect={handleUserSelect}
        addUserWarning={addUserWarning}
        addingUser={addingUser}
        onAddUserToRole={handleAddUserToRole}
        onCancelAddUser={() => {
          setIsAddUserInlineOpen(false)
          setSelectedUserId("")
          setAddUserWarning(null)
        }}
      />
    </AdminTablePage>
  )
}
