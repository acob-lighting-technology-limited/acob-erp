"use client"

import { Fragment, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AdminTablePage } from "@/components/admin/admin-table-page"
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
import { ChevronDown, ChevronUp, Mail, Pencil, Plus, Users, Building } from "lucide-react"
import { toast } from "sonner"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"

import { logger } from "@/lib/logger"

const log = logger("hr-departments")


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
          .select("role, department, is_department_lead, lead_departments")
          .eq("id", user.id)
          .single()

        const canManageDepartments = ["developer", "super_admin", "admin"].includes(profile?.role || "")

        setCurrentUserAccess({
          canManageDepartments,
        })
      }

      // Fetch departments
      const { data: depts, error } = await supabase.from("departments").select("*").order("name")

      if (error) throw error

      const { data: profiles } = await applyAssignableStatusFilter(
        supabase
          .from("profiles")
          .select(
            "id, first_name, last_name, company_email, additional_email, company_role, employment_status, department"
          ),
        { allowLegacyNullStatus: false }
      )

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
      log.error("Error fetching departments:", error)
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
      log.error("Error saving department:", error)
      toast.error(error.message || "Failed to save department")
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
    <AdminTablePage
      title="Departments"
      description="Manage company departments and organizational structure"
      icon={Building}
      backLinkHref="/admin/hr"
      backLinkLabel="Back to HR"
      actions={
        currentUserAccess.canManageDepartments ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
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
    >
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
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
                      <TableRow
                        key={dept.id}
                        className={cn(
                          "hover:bg-muted/30 cursor-pointer transition-colors",
                          isExpanded && "bg-muted/50"
                        )}
                        onClick={() => toggleDepartmentRow(dept.id)}
                      >
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleDepartmentRow(dept.id)
                            }}
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
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {currentUserAccess.canManageDepartments && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(dept)}
                                aria-label={`Edit department: ${dept.name}`}
                                title={`Edit department: ${dept.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${dept.id}-members`} className="bg-muted/10 hover:bg-muted/10 border-t-0">
                          <TableCell colSpan={7} className="p-0">
                            {members.length === 0 ? (
                              <p className="text-muted-foreground px-6 py-3 text-sm">
                                No employees in this department.
                              </p>
                            ) : (
                              <div className="animate-in slide-in-from-top-2 p-6 pt-2 duration-200">
                                <div className="bg-background overflow-hidden rounded-lg border shadow-sm">
                                  <Table>
                                    <TableHeader className="bg-muted/30">
                                      <TableRow>
                                        <TableHead className="text-muted-foreground w-[70px] text-[10px] font-black tracking-widest uppercase">
                                          S/N
                                        </TableHead>
                                        <TableHead className="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
                                          Employee
                                        </TableHead>
                                        <TableHead className="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
                                          Contact
                                        </TableHead>
                                        <TableHead className="text-muted-foreground w-[180px] text-[10px] font-black tracking-widest uppercase">
                                          Role
                                        </TableHead>
                                        <TableHead className="w-[80px] text-right"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {members.map((member, memberIndex) => (
                                        <TableRow key={member.id} className="hover:bg-muted/5">
                                          <TableCell className="text-muted-foreground text-xs font-semibold">
                                            {memberIndex + 1}
                                          </TableCell>
                                          <TableCell className="text-sm font-semibold">
                                            {[member.first_name, member.last_name].filter(Boolean).join(" ") ||
                                              "Unknown"}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            <div className="flex items-center gap-2">
                                              <Mail className="h-3 w-3" />
                                              <span className="truncate">
                                                {[member.company_email, member.additional_email]
                                                  .filter(Boolean)
                                                  .join(" | ")}
                                              </span>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                              {member.company_role || "Employee"}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Link href={`/admin/hr/employees?userId=${member.id}`}>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                aria-label="Edit employee department"
                                                title="Edit employee department"
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                            </Link>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
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
    </AdminTablePage>
  )
}
