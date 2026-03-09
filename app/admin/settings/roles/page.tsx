"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, Shield, Users } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { DepartmentLeadsManager } from "@/components/admin/department-leads-manager"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/patterns"
import { ASSIGNABLE_ROLES } from "@/lib/role-management"

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  user_count?: number
  is_system: boolean
  created_at: string
}

interface RoleMember {
  id: string
  first_name: string | null
  last_name: string | null
  company_email: string | null
  department: string | null
  employment_status: string | null
  created_at: string
}

const defaultPermissions = [
  { key: "users.view", label: "View Users" },
  { key: "users.manage", label: "Manage Users" },
  { key: "roles.manage", label: "Manage Roles" },
  { key: "hr.view", label: "View HR Data" },
  { key: "hr.manage", label: "Manage HR" },
  { key: "finance.view", label: "View Finance" },
  { key: "finance.manage", label: "Manage Finance" },
  { key: "inventory.view", label: "View Inventory" },
  { key: "inventory.manage", label: "Manage Inventory" },
  { key: "purchasing.view", label: "View Purchasing" },
  { key: "purchasing.manage", label: "Manage Purchasing" },
  { key: "settings.manage", label: "Manage Settings" },
  { key: "reports.view", label: "View Reports" },
]

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", permissions: [] as string[] })
  const [roleUsersOpen, setRoleUsersOpen] = useState(false)
  const [selectedRoleName, setSelectedRoleName] = useState<string>("")
  const [roleUsers, setRoleUsers] = useState<RoleMember[]>([])
  const [roleUsersLoading, setRoleUsersLoading] = useState(false)

  useEffect(() => {
    fetchRoles()
  }, [])

  async function fetchRoles() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("roles").select("*").order("name")

      if (error) {
        if (error.code === "42P01") {
          // Table doesn't exist, use default roles
          setRoles([
            {
              id: "1",
              name: "super_admin",
              description: "Full system access",
              permissions: defaultPermissions.map((p) => p.key),
              is_system: true,
              created_at: new Date().toISOString(),
            },
            {
              id: "2",
              name: "developer",
              description: "Developer-level access (matches Super Admin)",
              permissions: defaultPermissions.map((p) => p.key),
              is_system: true,
              created_at: new Date().toISOString(),
            },
            {
              id: "3",
              name: "admin",
              description: "Administrative access",
              permissions: ["users.view", "users.manage", "hr.view", "hr.manage", "finance.view", "reports.view"],
              is_system: true,
              created_at: new Date().toISOString(),
            },
            {
              id: "4",
              name: "employee",
              description: "Standard employee access",
              permissions: ["hr.view"],
              is_system: true,
              created_at: new Date().toISOString(),
            },
          ])
          return
        }
        throw error
      }

      // Get user counts per role
      const { data: profiles } = await supabase.from("profiles").select("role")
      const roleCounts = new Map<string, number>()
      profiles?.forEach((p) => {
        roleCounts.set(p.role, (roleCounts.get(p.role) || 0) + 1)
      })

      const rolesWithCounts = (data || []).map((r) => ({
        ...r,
        user_count: roleCounts.get(r.name) || 0,
      }))

      setRoles(rolesWithCounts)
    } catch (error: any) {
      console.error("Error loading roles:", error)
      // If table missing, fallback to defaults
      if (error?.code === "42P01" || error?.message?.includes("relation")) {
        setRoles([
          {
            id: "1",
            name: "super_admin",
            description: "Full system access",
            permissions: defaultPermissions.map((p) => p.key),
            is_system: true,
            created_at: new Date().toISOString(),
          },
          {
            id: "2",
            name: "developer",
            description: "Developer-level access (matches Super Admin)",
            permissions: defaultPermissions.map((p) => p.key),
            is_system: true,
            created_at: new Date().toISOString(),
          },
          {
            id: "3",
            name: "admin",
            description: "Administrative access",
            permissions: ["users.view", "users.manage", "hr.view", "hr.manage", "finance.view", "reports.view"],
            is_system: true,
            created_at: new Date().toISOString(),
          },
          {
            id: "4",
            name: "employee",
            description: "Standard employee access",
            permissions: ["hr.view"],
            is_system: true,
            created_at: new Date().toISOString(),
          },
        ])
        toast.warning("Roles table not found, using defaults")
      } else {
        toast.error(`Failed to load roles: ${error.message || "Unknown error"}`)
      }
    } finally {
      setLoading(false)
    }
  }

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
      fetchRoles()
    } catch (error: any) {
      toast.error(error.message || "Failed to save")
    }
  }

  async function handleDelete(role: Role) {
    if (role.is_system) {
      toast.error("Cannot delete system roles")
      return
    }
    if (!confirm(`Delete role "${role.name}"?`)) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from("roles").delete().eq("id", role.id)
      if (error) throw error
      toast.success("Deleted")
      fetchRoles()
    } catch (error: any) {
      toast.error(error.message)
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

  function togglePermission(key: string) {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }))
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
    } catch (error: any) {
      toast.error(error?.message || "Failed to load role users")
    } finally {
      setRoleUsersLoading(false)
    }
  }

  const stats = {
    total: roles.filter((role) => !(role.is_system && !ASSIGNABLE_ROLES.includes(role.name as any))).length,
    system: roles.filter((role) => role.is_system && ASSIGNABLE_ROLES.includes(role.name as any)).length,
    custom: roles.filter((role) => !role.is_system).length,
  }

  const visibleRoles = roles.filter((role) => {
    // Hide legacy removed system roles (e.g. old "lead") while keeping all custom roles.
    if (role.is_system && !ASSIGNABLE_ROLES.includes(role.name as any)) return false
    return role.name !== "manager"
  })

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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingRole ? "Edit" : "Create"} Role</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Role Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., accountant"
                    required
                    disabled={editingRole?.is_system}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                    {defaultPermissions.map((perm) => (
                      <div key={perm.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={perm.key}
                          checked={formData.permissions.includes(perm.key)}
                          onCheckedChange={() => togglePermission(perm.key)}
                        />
                        <label htmlFor={perm.key} className="cursor-pointer text-sm">
                          {perm.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingRole ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>{visibleRoles.length} roles defined</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : visibleRoles.length === 0 ? (
            <EmptyState title="No roles defined" icon={Shield} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">S/N</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRoles.map((role, index) => (
                  <TableRow key={role.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium capitalize">{role.name.replace("_", " ")}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{role.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{role.permissions?.length || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:underline"
                        onClick={() => openRoleUsers(role.name)}
                      >
                        <Users className="text-muted-foreground h-4 w-4" />
                        {role.user_count || 0}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.is_system ? "destructive" : "secondary"}>
                        {role.is_system ? "System" : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(role)}
                          disabled={role.is_system}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DepartmentLeadsManager />

      <Dialog open={roleUsersOpen} onOpenChange={setRoleUsersOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedRoleName.replace("_", " ")} Users</DialogTitle>
            <DialogDescription>Users currently assigned this role.</DialogDescription>
          </DialogHeader>

          {roleUsersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : roleUsers.length === 0 ? (
            <EmptyState title="No users in this role" icon={Users} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">S/N</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleUsers.map((member, index) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {member.first_name || member.last_name
                          ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.company_email || "—"}</TableCell>
                      <TableCell>{member.department || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={member.employment_status === "active" ? "default" : "secondary"}>
                          {member.employment_status || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(member.created_at).toLocaleDateString("en-NG")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminTablePage>
  )
}
