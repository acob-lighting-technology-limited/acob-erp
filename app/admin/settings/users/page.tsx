"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Users, Search, Filter, Shield, Pencil, UserPlus } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getAssignableRolesForActor } from "@/lib/role-management"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState, FormFieldGroup, ListToolbar } from "@/components/ui/patterns"
import { TableSkeleton } from "@/components/ui/query-states"

// Allowlist of valid roles for validation
const ALLOWED_ROLES = ["developer", "super_admin", "admin", "employee", "visitor"] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

function isValidRole(role: string): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole)
}

function getRoleOptions(currentUserRole: string): AllowedRole[] {
  return getAssignableRolesForActor(currentUserRole).filter((role): role is AllowedRole => isValidRole(role))
}

interface User {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string
  admin_domains?: string[] | null
  department: string | null
  is_active: boolean
  employment_status: string
  created_at: string
  last_sign_in?: string | null
}

const roleColors: Record<string, string> = {
  developer: "destructive",
  super_admin: "destructive",
  admin: "default",
  employee: "secondary",
  visitor: "secondary",
}

import { useSearchParams } from "next/navigation"

import { logger } from "@/lib/logger"

const log = logger("settings-users")

interface UsersSettingsData {
  users: User[]
  currentUserRole: string
}

async function fetchUsersSettingsData(): Promise<UsersSettingsData> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_email, first_name, last_name, role, admin_domains, department, employment_status, created_at")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const users = (data || []).map((u: any) => ({
    ...u,
    email: u.company_email,
    is_active: u.employment_status === "active",
    employment_status: u.employment_status || "active",
  }))

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  let currentUserRole = ""
  if (currentUser?.id) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()
    currentUserRole = me?.role || ""
  }

  return { users, currentUserRole }
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ role: "", employment_status: "active", admin_domains: [] as string[] })
  const ADMIN_DOMAIN_OPTIONS = ["hr", "finance", "assets", "reports", "tasks", "projects", "communications"] as const

  const { data: settingsData, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminUsersSettings(),
    queryFn: fetchUsersSettingsData,
  })

  const users: User[] = settingsData?.users ?? []
  const currentUserRole: string = settingsData?.currentUserRole ?? ""

  useEffect(() => {
    const roleParam = searchParams.get("role")
    // Validate role param against allowlist before using
    if (roleParam && (roleParam === "all" || isValidRole(roleParam))) {
      setRoleFilter(roleParam)
    }
  }, [searchParams])

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return

    try {
      if (formData.role === "admin" && formData.admin_domains.length === 0) {
        throw new Error("Admin role requires at least one domain")
      }

      const response = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: editingUser.id,
          role: formData.role,
          employment_status: formData.employment_status,
          admin_domains: formData.role === "admin" ? formData.admin_domains : [],
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to update")

      toast.success("User updated")
      setIsDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsersSettings() })
    } catch (error: any) {
      toast.error(error.message || "Failed to update")
    }
  }

  function openEdit(user: User) {
    setEditingUser(user)
    // Initialize with the user's actual employment_status, not a derived value
    setFormData({
      role: user.role,
      employment_status: user.employment_status || (user.is_active ? "active" : "suspended"),
      admin_domains: Array.isArray(user.admin_domains) ? user.admin_domains : [],
    })
    setIsDialogOpen(true)
  }

  function toggleAdminDomain(domain: string, checked: boolean) {
    setFormData((prev) => ({
      ...prev,
      admin_domains: checked
        ? Array.from(new Set([...prev.admin_domains, domain]))
        : prev.admin_domains.filter((d) => d !== domain),
    }))
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
  }

  const filtered = users.filter((u) => {
    const name = `${u.first_name || ""} ${u.last_name || ""} ${u.email || ""}`.toLowerCase()
    const matchesSearch = name.includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => ["developer", "admin", "super_admin"].includes(u.role)).length,
  }

  const roles = Array.from(new Set(users.map((u) => u.role)))

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false)
  const [userToAdd, setUserToAdd] = useState<string>("")
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [addUserWarning, setAddUserWarning] = useState<string | null>(null)

  // Fetch all users for the "Add User" dialog (to pick from)
  async function fetchAllUsers() {
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("id, company_email, first_name, last_name, role, department, employment_status, created_at")
      .order("first_name")

    if (data) {
      // Map company_email to email for the UI
      const mappedUsers = data.map((u: any) => ({
        ...u,
        email: u.company_email,
        is_active: u.employment_status === "active",
        employment_status: u.employment_status || "active",
      }))
      setAvailableUsers(mappedUsers)
    }
  }

  function openAddUserDialog() {
    fetchAllUsers()
    setAddUserWarning(null)
    setUserToAdd("")
    setIsAddUserDialogOpen(true)
  }

  function handleUserSelect(userId: string) {
    setUserToAdd(userId)
    const user = availableUsers.find((u) => u.id === userId)
    if (!user) return

    if (user.role === roleFilter) {
      setAddUserWarning(`${user.first_name} is already a ${roleFilter}.`)
    } else {
      setAddUserWarning(`User will be removed from "${user.role}" role and assigned to "${roleFilter}".`)
    }
  }

  async function handleAddUserToRole() {
    if (!userToAdd || roleFilter === "all") return

    try {
      const response = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userToAdd, role: roleFilter }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to update role")

      toast.success(`User role updated to ${roleFilter}`)
      setIsAddUserDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsersSettings() })
    } catch (error: any) {
      log.error("Error adding user to role:", error)
      toast.error(error.message || "Failed to update role")
    }
  }

  return (
    <AdminTablePage
      title="User Management"
      description="Manage user accounts and roles."
      icon={Users}
      backLinkHref="/admin/settings"
      backLinkLabel="Back to Settings"
      actions={
        <div className="flex gap-2">
          {roleFilter !== "all" && (
            <Button onClick={openAddUserDialog} variant="secondary">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User to {roleFilter.replace("_", " ")}
            </Button>
          )}
          <Link href="/admin/settings/users/invite">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </Link>
        </div>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
          <StatCard title="Total Users" value={stats.total} icon={Users} />
          <StatCard title="Active" value={stats.active} icon={Users} />
          <StatCard title="Admins" value={stats.admins} icon={Shield} />
        </div>
      }
      filters={
        <ListToolbar
          search={
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          }
          filters={
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>{filtered.length} users</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No users found" icon={Users} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.first_name || user.last_name
                        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[user.role] as any} className="capitalize">
                        {user.role?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.department || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.employment_status === "separated" ? "Separated" : user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
          <form onSubmit={handleUpdateRole}>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormFieldGroup label="User">
                <p className="text-muted-foreground text-sm">{editingUser?.email}</p>
              </FormFieldGroup>
              <FormFieldGroup label="Role">
                <Select
                  value={formData.role}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: v,
                      admin_domains: v === "admin" ? prev.admin_domains : [],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getRoleOptions(currentUserRole).map((role) => (
                      <SelectItem key={role} value={role}>
                        {role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormFieldGroup>
              {formData.role === "admin" && (
                <FormFieldGroup label="Admin Domains">
                  <div className="grid grid-cols-2 gap-2">
                    {ADMIN_DOMAIN_OPTIONS.map((domain) => {
                      const checked = formData.admin_domains.includes(domain)
                      return (
                        <label
                          key={domain}
                          className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm capitalize"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleAdminDomain(domain, e.target.checked)}
                          />
                          {domain}
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-muted-foreground text-xs">At least one domain is required for admin users.</p>
                </FormFieldGroup>
              )}
              <FormFieldGroup label="Employment Status">
                <div className="flex justify-end">
                  <Select
                    value={formData.employment_status}
                    onValueChange={(v) => setFormData({ ...formData, employment_status: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FormFieldGroup>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add User to Role Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add User to {roleFilter.replace("_", " ")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormFieldGroup label="Select User">
              <Select value={userToAdd} onValueChange={handleUserSelect}>
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
            <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUserToRole} disabled={!userToAdd}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminTablePage>
  )
}
