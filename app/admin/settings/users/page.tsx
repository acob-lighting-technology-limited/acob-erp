"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Search, Filter, Shield, UserPlus } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { StatCard } from "@/components/ui/stat-card"
import { ListToolbar } from "@/components/ui/patterns"
import { useSearchParams } from "next/navigation"
import { logger } from "@/lib/logger"
import { isValidRole } from "./_lib/role-helpers"
import { fetchUsersSettingsData, fetchAllUsersForPicker, formatDate, type User } from "./_lib/queries"
import { EditUserDialog } from "./_components/edit-user-dialog"
import { AddUserToRoleDialog } from "./_components/add-user-to-role-dialog"
import { UsersTable } from "./_components/users-table"

const log = logger("settings-users")

export default function UsersPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ role: "", employment_status: "active", admin_domains: [] as string[] })

  const { data: settingsData, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.adminUsersSettings(),
    queryFn: fetchUsersSettingsData,
  })

  const users: User[] = settingsData?.users ?? []
  const currentUserRole: string = settingsData?.currentUserRole ?? ""

  useEffect(() => {
    const roleParam = searchParams.get("role")
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
    setFormData({
      role: user.role,
      employment_status: user.employment_status || (user.is_active ? "active" : "suspended"),
      admin_domains: Array.isArray(user.admin_domains) ? user.admin_domains : [],
    })
    setIsDialogOpen(true)
  }

  const filtered = users.filter((u) => {
    const name = `${u.first_name || ""} ${u.last_name || ""} ${u.email || ""}`.toLowerCase()
    return name.includes(searchQuery.toLowerCase()) && (roleFilter === "all" || u.role === roleFilter)
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

  function openAddUserDialog() {
    fetchAllUsersForPicker().then(setAvailableUsers)
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
      <UsersTable users={filtered} loading={loading} onEdit={openEdit} formatDate={formatDate} />

      <EditUserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingUser={editingUser}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleUpdateRole}
        currentUserRole={currentUserRole}
      />

      <AddUserToRoleDialog
        open={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        roleFilter={roleFilter}
        userToAdd={userToAdd}
        onUserSelect={handleUserSelect}
        availableUsers={availableUsers}
        addUserWarning={addUserWarning}
        onConfirm={handleAddUserToRole}
      />
    </AdminTablePage>
  )
}
