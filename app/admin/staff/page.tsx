"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import {
  Users,
  Search,
  Filter,
  Edit,
  Mail,
  Phone,
  Building2,
  MapPin,
  Shield,
  UserCog,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import type { UserRole } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor, canAssignRoles, DEPARTMENTS } from "@/lib/permissions"

interface Staff {
  id: string
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  department: string
  company_role: string | null
  role: UserRole
  phone_number: string | null
  residential_address: string | null
  current_work_location: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
  created_at: string
}

interface UserProfile {
  role: UserRole
}

export default function AdminStaffPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [staff, setStaff] = useState<Staff[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [staffFilter, setStaffFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [nameSortOrder, setNameSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Form states
  const [editForm, setEditForm] = useState({
    role: "staff" as UserRole,
    department: "",
    company_role: "",
    is_department_lead: false,
    lead_departments: [] as string[],
  })

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  // Handle userId from search params (for edit dialog)
  useEffect(() => {
    const userId = searchParams?.get("userId")
    if (userId && staff.length > 0 && !isEditDialogOpen) {
      const user = staff.find((s) => s.id === userId)
      if (user) {
        handleEditStaff(user)
      }
    }
  }, [searchParams, staff, isEditDialogOpen])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, lead_departments")
        .eq("id", user.id)
        .single()

      setUserProfile(profile)

      // Fetch staff - leads can only see staff in their departments
      let query = supabase
        .from("profiles")
        .select("*")
        .order("last_name", { ascending: true })

      // If user is a lead, filter by their lead departments
      if (profile?.role === "lead" && profile.lead_departments && profile.lead_departments.length > 0) {
        query = query.in("department", profile.lead_departments)
      }

      const { data, error } = await query

      if (error) throw error

      setStaff(data || [])
    } catch (error: any) {
      console.error("Error loading staff:", error)
      toast.error("Failed to load staff")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditStaff = (staffMember: Staff) => {
    setSelectedStaff(staffMember)
    setEditForm({
      role: staffMember.role,
      department: staffMember.department,
      company_role: staffMember.company_role || "",
      is_department_lead: staffMember.is_department_lead,
      lead_departments: staffMember.lead_departments || [],
    })
    setIsEditDialogOpen(true)
  }

  const handleSaveStaff = async () => {
    try {
      if (!selectedStaff) return

      // Check if user can assign this role
      if (userProfile && !canAssignRoles(userProfile.role, editForm.role)) {
        toast.error("You don't have permission to assign this role")
        return
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          role: editForm.role,
          department: editForm.department,
          company_role: editForm.company_role || null,
          is_department_lead: editForm.is_department_lead,
          lead_departments: editForm.lead_departments,
          is_admin: ['super_admin', 'admin'].includes(editForm.role),
        })
        .eq("id", selectedStaff.id)

      if (error) throw error

      toast.success("Staff member updated successfully")
      setIsEditDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error updating staff:", error)
      toast.error("Failed to update staff member")
    }
  }

  const filteredStaff = staff
    .filter((member) => {
      const matchesSearch =
        member.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.company_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.company_role?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDepartment =
        departmentFilter === "all" || member.department === departmentFilter

      const matchesStaff =
        staffFilter === "all" || member.id === staffFilter

      const matchesRole =
        roleFilter === "all" || member.role === roleFilter

      return matchesSearch && matchesDepartment && matchesStaff && matchesRole
    })
    .sort((a, b) => {
      const lastNameA = formatName(a.last_name).toLowerCase()
      const lastNameB = formatName(b.last_name).toLowerCase()
      
      if (nameSortOrder === "asc") {
        return lastNameA.localeCompare(lastNameB)
      } else {
        return lastNameB.localeCompare(lastNameA)
      }
    })

  const departments = Array.from(
    new Set(staff.map((s) => s.department).filter(Boolean))
  ) as string[]

  const roles: UserRole[] = ["visitor", "staff", "lead", "admin", "super_admin"]

  const stats = {
    total: staff.length,
    admins: staff.filter((s) => ["super_admin", "admin"].includes(s.role)).length,
    leads: staff.filter((s) => s.role === "lead").length,
    staff: staff.filter((s) => s.role === "staff").length,
  }

  const getAvailableRoles = (): UserRole[] => {
    if (!userProfile) return []

    if (userProfile.role === "super_admin") {
      return ["visitor", "staff", "lead", "admin", "super_admin"]
    } else if (userProfile.role === "admin") {
      return ["visitor", "staff", "lead"]
    }

    return []
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-64"></div>
                <div className="h-5 bg-muted rounded w-96"></div>
              </div>
              <div className="h-10 bg-muted rounded w-32"></div>
            </div>

            {/* Stats Skeleton */}
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-2">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-24"></div>
                        <div className="h-8 bg-muted rounded w-16"></div>
                      </div>
                      <div className="h-12 w-12 bg-muted rounded-lg"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters Skeleton */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="h-10 bg-muted rounded flex-1"></div>
                  <div className="h-10 bg-muted rounded w-48"></div>
                  <div className="h-10 bg-muted rounded w-48"></div>
                  <div className="h-10 bg-muted rounded w-32"></div>
                </div>
              </CardContent>
            </Card>

            {/* Table Skeleton */}
            <Card className="border-2">
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded"></div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Staff Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              View and manage staff members, roles, and permissions
            </p>
          </div>
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-1 sm:gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="gap-1 sm:gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Card</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Staff</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Admins</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.admins}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Leads</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.leads}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <UserCog className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Staff Members</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.staff}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <SearchableSelect
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
                placeholder="All Departments"
                searchPlaceholder="Search departments..."
                icon={<Building2 className="h-4 w-4" />}
                className="w-full md:w-48"
                options={[
                  { value: "all", label: "All Departments" },
                  ...departments.map((dept) => ({
                    value: dept,
                    label: dept,
                    icon: <Building2 className="h-3 w-3" />,
                  })),
                ]}
              />
              <SearchableSelect
                value={staffFilter}
                onValueChange={setStaffFilter}
                placeholder="All Staff"
                searchPlaceholder="Search staff..."
                icon={<User className="h-4 w-4" />}
                className="w-full md:w-48"
                options={[
                  { value: "all", label: "All Staff" },
                  ...staff.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                    icon: <User className="h-3 w-3" />,
                  })),
                ]}
              />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Staff List */}
        {filteredStaff.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNameSortOrder(nameSortOrder === "asc" ? "desc" : "asc")}
                            className="h-6 w-6 p-0"
                          >
                            {nameSortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredStaff.map((member, index) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/staff/${member.id}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">
                            {formatName(member.last_name)}, {formatName(member.first_name)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{member.company_email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{member.department}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={getRoleBadgeColor(member.role)}>
                            {getRoleDisplayName(member.role)}
                          </Badge>
                          {member.is_department_lead && (
                            <Badge variant="outline">Lead</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {member.company_role || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-8 sm:h-auto text-xs sm:text-sm"
                          >
                            <Link href={`/admin/staff/${member.id}`}>
                              <span className="hidden sm:inline">View</span>
                              <span className="sm:hidden">👁</span>
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 sm:h-auto sm:w-auto p-0 sm:p-2"
                            onClick={() => handleEditStaff(member)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStaff.map((member) => (
                <Card key={member.id} className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-background">
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/admin/staff/${member.id}`}
                        className="flex items-start gap-3 flex-1 hover:text-primary transition-colors"
                      >
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg">
                            {member.first_name} {member.last_name}
                          </CardTitle>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={getRoleBadgeColor(member.role)}>
                              {getRoleDisplayName(member.role)}
                            </Badge>
                            {member.is_department_lead && (
                              <Badge variant="outline">Lead</Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditStaff(member)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{member.company_email}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{member.department}</span>
                    </div>

                    {member.company_role && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserCog className="h-4 w-4" />
                        <span>{member.company_role}</span>
                      </div>
                    )}

                    {member.phone_number && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{member.phone_number}</span>
                      </div>
                    )}

                    {member.current_work_location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{member.current_work_location}</span>
                      </div>
                    )}

                    {member.is_department_lead && member.lead_departments.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Leading:</p>
                        <div className="flex flex-wrap gap-1">
                          {member.lead_departments.map((dept, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-2 py-1 rounded"
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="flex-1"
                      >
                        <Link href={`/admin/staff/${member.id}`}>View Details</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditStaff(member)}
                        className="flex-1 gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Staff Found
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || departmentFilter !== "all" || roleFilter !== "all"
                  ? "No staff matches your filters"
                  : "No staff members found"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Staff Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedStaff?.first_name} {selectedStaff?.last_name}
            </DialogTitle>
            <DialogDescription>
              Update staff member's role, department, and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: UserRole) => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger>
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
              <p className="text-xs text-muted-foreground mt-1">
                {userProfile?.role === "admin"
                  ? "As Admin, you can assign: Visitor, Staff, and Lead roles"
                  : "As Super Admin, you can assign any role"}
              </p>
            </div>

            <div>
              <Label htmlFor="department">Department *</Label>
              <Select
                value={editForm.department}
                onValueChange={(value) => setEditForm({ ...editForm, department: value })}
              >
                <SelectTrigger>
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
              <Label htmlFor="company_role">Position/Title</Label>
              <Input
                id="company_role"
                value={editForm.company_role}
                onChange={(e) => setEditForm({ ...editForm, company_role: e.target.value })}
                placeholder="e.g., Senior Developer"
              />
            </div>

            {editForm.role === "lead" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_department_lead"
                    checked={editForm.is_department_lead}
                    onChange={(e) =>
                      setEditForm({ ...editForm, is_department_lead: e.target.checked })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="is_department_lead">Is Department Lead</Label>
                </div>

                {editForm.is_department_lead && (
                  <div>
                    <Label>Lead Departments</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {DEPARTMENTS.map((dept) => (
                        <div key={dept} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`dept-${dept}`}
                            checked={editForm.lead_departments.includes(dept)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm({
                                  ...editForm,
                                  lead_departments: [...editForm.lead_departments, dept],
                                })
                              } else {
                                setEditForm({
                                  ...editForm,
                                  lead_departments: editForm.lead_departments.filter(
                                    (d) => d !== dept
                                  ),
                                })
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`dept-${dept}`} className="text-sm">
                            {dept}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStaff}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
