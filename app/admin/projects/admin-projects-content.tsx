"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  FolderKanban,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  User,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
} from "lucide-react"
import { dateValidation } from "@/lib/validation"
import type { Project, employee } from "./page"
import { AdminTablePage } from "@/components/admin/admin-table-page"

interface AdminProjectsContentProps {
  initialProjects: Project[]
  initialemployee: employee[]
}

export function AdminProjectsContent({ initialProjects, initialemployee }: AdminProjectsContentProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [employee] = useState<employee[]>(initialemployee)
  const activeEmployees = employee.filter(
    (member) => member.employment_status === "active" || !member.employment_status
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Dialog states
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Form states
  const [projectForm, setProjectForm] = useState({
    project_name: "",
    location: "",
    deployment_start_date: "",
    deployment_end_date: "",
    capacity_w: "",
    technology_type: "",
    project_manager_id: "",
    description: "",
    status: "planning",
  })

  const supabase = createClient()

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          *,
          project_manager:profiles!projects_project_manager_id_fkey (
            first_name,
            last_name
          ),
          created_by_user:profiles!projects_created_by_fkey (
            first_name,
            last_name
          )
        `
        )
        .order("created_at", { ascending: false })

      if (error) throw error
      setProjects((data as any) || [])
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to refresh data")
    }
  }

  const handleOpenProjectDialog = (project?: Project) => {
    if (project) {
      setSelectedProject(project)
      setProjectForm({
        project_name: project.project_name,
        location: project.location,
        deployment_start_date: project.deployment_start_date,
        deployment_end_date: project.deployment_end_date,
        capacity_w: project.capacity_w?.toString() || "",
        technology_type: project.technology_type || "",
        project_manager_id: project.project_manager_id || "",
        description: project.description || "",
        status: project.status,
      })
    } else {
      setSelectedProject(null)
      setProjectForm({
        project_name: "",
        location: "",
        deployment_start_date: "",
        deployment_end_date: "",
        capacity_w: "",
        technology_type: "",
        project_manager_id: "",
        description: "",
        status: "planning",
      })
    }
    setIsProjectDialogOpen(true)
  }

  const handleSaveProject = async () => {
    if (
      !projectForm.project_name ||
      !projectForm.location ||
      !projectForm.deployment_start_date ||
      !projectForm.deployment_end_date
    ) {
      toast.error("Please fill in all required fields")
      return
    }

    const dateError = dateValidation.validateDateRange(
      projectForm.deployment_start_date,
      projectForm.deployment_end_date,
      "deployment date"
    )
    if (dateError) {
      toast.error(dateError)
      return
    }

    setIsSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const projectData = {
        project_name: projectForm.project_name,
        location: projectForm.location,
        deployment_start_date: projectForm.deployment_start_date,
        deployment_end_date: projectForm.deployment_end_date,
        capacity_w: projectForm.capacity_w ? parseFloat(projectForm.capacity_w) : null,
        technology_type: projectForm.technology_type || null,
        project_manager_id: projectForm.project_manager_id || null,
        description: projectForm.description || null,
        status: projectForm.status,
      }

      if (selectedProject) {
        const { error } = await supabase.from("projects").update(projectData).eq("id", selectedProject.id)
        if (error) throw error

        // Audit logging handled by database trigger

        toast.success("Project updated successfully")
      } else {
        const { error } = await supabase.from("projects").insert({
          ...projectData,
          created_by: user.id,
        })
        if (error) throw error

        // Audit logging handled by database trigger

        toast.success("Project created successfully")
      }

      setIsProjectDialogOpen(false)
      loadData()
    } catch (error) {
      console.error("Error saving project:", error)
      toast.error(`Failed to save project: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete || isDeleting) return

    setIsDeleting(true)
    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectToDelete.id)
      if (error) throw error

      // Audit logging handled by database trigger

      toast.success("Project deleted successfully")
      setIsDeleteDialogOpen(false)
      setProjectToDelete(null)
      loadData()
    } catch (error) {
      console.error("Error deleting project:", error)
      toast.error(`Failed to delete project: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planning":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "on_hold":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: projects.length,
    planning: projects.filter((p) => p.status === "planning").length,
    active: projects.filter((p) => p.status === "active").length,
    completed: projects.filter((p) => p.status === "completed").length,
  }

  return (
    <AdminTablePage
      title="Project Management"
      description="Create and manage projects"
      icon={FolderKanban}
      actions={
        <Button onClick={() => handleOpenProjectDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Project
        </Button>
      }
      stats={
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderKanban className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planning</CardTitle>
              <Clock className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.planning}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>
      }
      filters={
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      }
      filtersInCard={false}
    >
      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by creating your first project"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={() => handleOpenProjectDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project, index) => (
                  <TableRow key={project.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-foreground font-medium">{project.project_name}</div>
                        {project.description && (
                          <div className="text-muted-foreground line-clamp-1 text-xs">{project.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                        <span>{project.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="text-foreground">{formatDate(project.deployment_start_date)}</div>
                        <div className="text-muted-foreground">{formatDate(project.deployment_end_date)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.project_manager ? (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="text-muted-foreground h-3.5 w-3.5" />
                          <span>
                            {project.project_manager.first_name} {project.project_manager.last_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => router.push(`/admin/projects/${project.id}`)}
                        >
                          Manage
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Edit project"
                          onClick={() => handleOpenProjectDialog(project)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Delete project"
                          onClick={() => {
                            setProjectToDelete(project)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
      {/* Create/Edit Project Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {selectedProject
                ? "Update project details below"
                : "Fill in the project information. Fields marked with * are required."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project_name">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="project_name"
                value={projectForm.project_name}
                onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })}
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="location"
                value={projectForm.location}
                onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                placeholder="Enter project location"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deployment_start_date">
                  Deployment Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deployment_start_date"
                  type="date"
                  value={projectForm.deployment_start_date}
                  onChange={(e) => setProjectForm({ ...projectForm, deployment_start_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deployment_end_date">
                  Deployment End Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deployment_end_date"
                  type="date"
                  min={projectForm.deployment_start_date}
                  value={projectForm.deployment_end_date}
                  onChange={(e) => setProjectForm({ ...projectForm, deployment_end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity_w">Capacity (W)</Label>
                <Input
                  id="capacity_w"
                  type="number"
                  value={projectForm.capacity_w}
                  onChange={(e) => setProjectForm({ ...projectForm, capacity_w: e.target.value })}
                  placeholder="Enter capacity in watts"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="technology_type">Technology Type</Label>
                <Input
                  id="technology_type"
                  value={projectForm.technology_type}
                  onChange={(e) => setProjectForm({ ...projectForm, technology_type: e.target.value })}
                  placeholder="e.g., Solar, Wind, Hybrid"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_manager_id">Project Manager</Label>
              <SearchableSelect
                value={projectForm.project_manager_id || "none"}
                onValueChange={(value) =>
                  setProjectForm({ ...projectForm, project_manager_id: value === "none" ? "" : value })
                }
                placeholder="Select project manager"
                searchPlaceholder="Search employee..."
                icon={<User className="h-4 w-4" />}
                options={[
                  { value: "none", label: "None" },
                  ...activeEmployees.map((member) => ({
                    value: member.id,
                    label: `${member.first_name} ${member.last_name} - ${member.department}`,
                  })),
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={projectForm.status}
                onValueChange={(value) => setProjectForm({ ...projectForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Enter project description"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProject} disabled={isSaving}>
              {isSaving ? "Saving..." : selectedProject ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project &quot;{projectToDelete?.project_name}&quot;. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProjectToDelete(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminTablePage>
  )
}
