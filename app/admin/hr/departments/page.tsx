"use client"

import { useEffect, useState } from "react"
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
import { Plus, Pencil, Trash2, Users, Building } from "lucide-react"
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

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
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

      // Fetch departments
      const { data: depts, error } = await supabase.from("departments").select("*").order("name")

      if (error) throw error

      // Get employee counts for each department
      const deptsWithCounts = await Promise.all(
        (depts || []).map(async (dept) => {
          const { count } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("department", dept.name)

          return {
            ...dept,
            employee_count: count || 0,
          }
        })
      )

      setDepartments(deptsWithCounts)
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
    setEditingDepartment(dept)
    setFormData({
      name: dept.name,
      description: dept.description || "",
      is_active: dept.is_active,
    })
    setIsDialogOpen(true)
  }

  function openCreateDialog() {
    setEditingDepartment(null)
    setFormData({ name: "", description: "", is_active: true })
    setIsDialogOpen(true)
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Departments"
        description="Manage company departments and organizational structure"
        icon={Building}
        backLink={{ href: "/admin", label: "Back to Admin" }}
        actions={
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
              action={{ label: "Add Department", onClick: openCreateDialog, icon: Plus }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{dept.description || "—"}</TableCell>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
