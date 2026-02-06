"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Pencil, Trash2, Shield, Users } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { DepartmentLeadsManager } from "@/components/admin/department-leads-manager"

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  user_count?: number
  is_system: boolean
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
              name: "admin",
              description: "Administrative access",
              permissions: ["users.view", "users.manage", "hr.view", "hr.manage", "finance.view", "reports.view"],
              is_system: true,
              created_at: new Date().toISOString(),
            },
            {
              id: "3",
              name: "manager",
              description: "Department manager access",
              permissions: ["hr.view", "finance.view", "inventory.view", "reports.view"],
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
            name: "admin",
            description: "Administrative access",
            permissions: ["users.view", "users.manage", "hr.view", "hr.manage", "finance.view", "reports.view"],
            is_system: true,
            created_at: new Date().toISOString(),
          },
          {
            id: "3",
            name: "manager",
            description: "Department manager access",
            permissions: ["hr.view", "finance.view", "inventory.view", "reports.view"],
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

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/settings" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          </div>
          <p className="text-muted-foreground">Configure access control for your organization</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                  <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-3">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>{roles.length} roles defined</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : roles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="font-semibold">No roles defined</h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles
                  .filter((role) => role.name !== "manager") // Hide manager role as requested
                  .map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium capitalize">{role.name.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {role.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{role.permissions?.length || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`/admin/settings/users?role=${role.name}`}
                          className="flex items-center gap-1 hover:underline"
                        >
                          <Users className="text-muted-foreground h-4 w-4" />
                          {role.user_count || 0}
                        </a>
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
    </div>
  )
}
