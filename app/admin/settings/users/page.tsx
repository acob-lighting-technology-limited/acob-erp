"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Users, Search, Filter, Shield, Pencil, UserPlus } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

// Allowlist of valid roles for validation
const ALLOWED_ROLES = [
  "developer",
  "super_admin",
  "admin",
  "manager",
  "employee",
  "user",
  "employee",
  "lead",
  "visitor",
] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

function isValidRole(role: string): role is AllowedRole {
  return ALLOWED_ROLES.includes(role as AllowedRole)
}

interface User {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string
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
  manager: "default",
  employee: "secondary",
  lead: "default",
}

import { useSearchParams } from "next/navigation"

export default function UsersPage() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ role: "", employment_status: "active" })
  const [currentUserRole, setCurrentUserRole] = useState<string>("")

  useEffect(() => {
    const roleParam = searchParams.get("role")
    // Validate role param against allowlist before using
    if (roleParam && (roleParam === "all" || isValidRole(roleParam))) {
      setRoleFilter(roleParam)
    }
  }, [searchParams])

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, company_email, first_name, last_name, role, department, employment_status, created_at")
        .order("created_at", { ascending: false })

      if (error) throw error

      // Map company_email to email and employment_status to is_active for the UI
      const mappedUsers = (data || []).map((u: any) => ({
        ...u,
        email: u.company_email,
        is_active: u.employment_status === "active",
        employment_status: u.employment_status || "active",
      }))

      setUsers(mappedUsers)

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      if (currentUser?.id) {
        const { data: me } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single()
        setCurrentUserRole(me?.role || "")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return

    try {
      const response = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: editingUser.id,
          role: formData.role,
          employment_status: formData.employment_status,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to update")

      toast.success("User updated")
      setIsDialogOpen(false)
      fetchUsers()
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
    })
    setIsDialogOpen(true)
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
      fetchUsers()
    } catch (error: any) {
      console.error("Error adding user to role:", error)
      toast.error(error.message || "Failed to update role")
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/admin/settings" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold">User Management</h1>
          </div>
          <p className="text-muted-foreground">Manage user accounts and roles</p>
        </div>
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
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>{filtered.length} users</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="font-semibold">No users found</h3>
            </div>
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
        <DialogContent>
          <form onSubmit={handleUpdateRole}>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>User</Label>
                <p className="text-muted-foreground text-sm">{editingUser?.email}</p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    {/* Manager removed */}
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    {currentUserRole === "developer" && <SelectItem value="developer">Developer</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Employment Status</Label>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to {roleFilter.replace("_", " ")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Select User</Label>
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
            </div>
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
    </div>
  )
}
