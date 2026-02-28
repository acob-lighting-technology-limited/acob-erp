"use client"

import { Fragment, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import { ChevronDown, ChevronUp, Mail, Pencil, Plus, Trash2, Users, Building } from "lucide-react"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

interface Department {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  employee_count?: number
}

interface DepartmentEmployee {
  id: string
  first_name: string | null
  last_name: string | null
  company_email: string | null
  additional_email: string | null
  company_role: string | null
  employment_status: string | null
  department: string | null
}

interface CurrentUserAccess {
  canManageDepartments: boolean
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentEmployees, setDepartmentEmployees] = useState<Record<string, DepartmentEmployee[]>>({})
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [currentUserAccess, setCurrentUserAccess] = useState<CurrentUserAccess>({
    canManageDepartments: false,
  })
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  })

  useEffect(() => {
    fetchDepartments()
  }, [])

  async function fetchDepartments() {
    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, department, lead_departments")
          .eq("id", user.id)
          .single()

        const leadDepartments = Array.isArray(profile?.lead_departments)
          ? profile.lead_departments
          : profile?.department
            ? [profile.department]
            : []
        const isHrGlobalLead = profile?.role === "lead" && leadDepartments.includes("Admin & HR")
        const canManageDepartments = profile?.role === "super_admin" || profile?.role === "admin" || isHrGlobalLead

        setCurrentUserAccess({
          canManageDepartments,
        })
      }

      // Fetch departments
      const { data: depts, error } = await supabase.from("departments").select("*").order("name")

      if (error) throw error

      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, company_email, additional_email, company_role, employment_status, department"
        )
        .eq("employment_status", "active")

      const employeesByDepartment: Record<string, DepartmentEmployee[]> = {}
      for (const profile of (profiles || []) as DepartmentEmployee[]) {
        const deptName = profile.department || "Unassigned"
        if (!employeesByDepartment[deptName]) employeesByDepartment[deptName] = []
        employeesByDepartment[deptName].push(profile)
      }

      const deptsWithCounts = (depts || []).map((dept) => ({
        ...dept,
        employee_count: employeesByDepartment[dept.name]?.length || 0,
      }))

      setDepartments(deptsWithCounts)
      setDepartmentEmployees(employeesByDepartment)
    } catch (error) {
      console.error("Error fetching departments:", error)
      toast.error("Failed to load departments")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (!currentUserAccess.canManageDepartments) {
        toast.error("You can view departments but cannot modify them")
        return
      }

      const supabase = createClient()

      if (editingDepartment) {
        // Update existing department
        const { error } = await supabase
          .from("departments")
          .update({
            name: formData.name,
            description: formData.description || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingDepartment.id)

        if (error) throw error
        toast.success("Department updated successfully")
      } else {
        // Create new department
        const { error } = await supabase.from("departments").insert({
          name: formData.name,
          description: formData.description || null,
          is_active: formData.is_active,
        })

        if (error) throw error
        toast.success("Department created successfully")
      }

      setIsDialogOpen(false)
      setEditingDepartment(null)
      setFormData({ name: "", description: "", is_active: true })
      fetchDepartments()
    } catch (error: any) {
      console.error("Error saving department:", error)
      toast.error(error.message || "Failed to save department")
    }
  }

  async function handleDelete(dept: Department) {
    if (!currentUserAccess.canManageDepartments) {
      toast.error("You can view departments but cannot delete them")
      return
    }

    if (!confirm(`Are you sure you want to delete "${dept.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const supabase = createClient()

      const { error } = await supabase.from("departments").delete().eq("id", dept.id)

      if (error) throw error

      toast.success("Department deleted successfully")
      fetchDepartments()
    } catch (error: any) {
      console.error("Error deleting department:", error)
      toast.error(error.message || "Failed to delete department")
    }
  }

  function openEditDialog(dept: Department) {
    if (!currentUserAccess.canManageDepartments) {
      toast.error("You can view departments but cannot edit them")
      return
    }

    setEditingDepartment(dept)
    setFormData({
      name: dept.name,
      description: dept.description || "",
      is_active: dept.is_active,
    })
    setIsDialogOpen(true)
  }

  function openCreateDialog() {
    if (!currentUserAccess.canManageDepartments) {
      toast.error("You can view departments but cannot create departments")
      return
    }

    setEditingDepartment(null)
    setFormData({ name: "", description: "", is_active: true })
    setIsDialogOpen(true)
  }

  function toggleDepartmentRow(deptId: string) {
    setExpandedDepartments((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Departments"
        description="Manage company departments and organizational structure"
        icon={Building}
        backLink={{ href: "/admin/hr", label: "Back to HR" }}
        actions={
          currentUserAccess.canManageDepartments ? (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingDepartment ? "Edit Department" : "Create Department"}</DialogTitle>
                    <DialogDescription>
                      {editingDepartment
                        ? "Update the department details below."
                        : "Add a new department to your organization."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Department Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Engineering, Sales, Marketing"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of the department's responsibilities..."
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_active">Active</Label>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingDepartment ? "Update" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Departments" value={departments.length} icon={Building} />
        <StatCard
          title="Active"
          value={departments.filter((d) => d.is_active).length}
          icon={Building}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Total Employees"
          value={departments.reduce((sum, d) => sum + (d.employee_count || 0), 0)}
          icon={Users}
        />
      </div>

      {/* Departments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Departments</CardTitle>
          <CardDescription>List of all departments in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : departments.length === 0 ? (
            <EmptyState
              icon={Building}
              title="No departments yet"
              description="Create your first department to get started."
              action={
                currentUserAccess.canManageDepartments
                  ? { label: "Add Department", onClick: openCreateDialog, icon: Plus }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept, index) => {
                  const isExpanded = expandedDepartments.has(dept.id)
                  const members = departmentEmployees[dept.name] || []

                  return (
                    <Fragment key={dept.id}>
                      <TableRow key={dept.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleDepartmentRow(dept.id)}
                            className="h-7 w-7"
                            aria-label={isExpanded ? `Collapse ${dept.name}` : `Expand ${dept.name}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {dept.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{dept.employee_count} employees</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={dept.is_active ? "default" : "secondary"}>
                            {dept.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {currentUserAccess.canManageDepartments && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(dept)}
                                  aria-label={`Edit department: ${dept.name}`}
                                  title={`Edit department: ${dept.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(dept)}
                                  disabled={(dept.employee_count ?? 0) > 0}
                                  aria-label={`Delete department: ${dept.name}`}
                                  title={
                                    (dept.employee_count ?? 0) > 0
                                      ? "Cannot delete department with employees"
                                      : `Delete department: ${dept.name}`
                                  }
                                >
                                  <Trash2 className="text-destructive h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${dept.id}-members`}>
                          <TableCell colSpan={7} className="bg-muted/20 py-3">
                            {members.length === 0 ? (
                              <p className="text-muted-foreground px-3 text-sm">No employees in this department.</p>
                            ) : (
                              <div className="space-y-2 px-2">
                                {members.map((member) => (
                                  <div
                                    key={member.id}
                                    className="bg-background flex items-center justify-between rounded-md border px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {[member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown"}
                                      </p>
                                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                        <Mail className="h-3 w-3" />
                                        <span className="truncate">
                                          {[member.company_email, member.additional_email].filter(Boolean).join(" | ")}
                                        </span>
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {member.company_role || "Employee"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
