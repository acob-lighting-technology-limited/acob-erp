"use client"

import { useState } from "react"
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
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { dateValidation } from "@/lib/validation"
import type { Project, Staff } from "./page"

interface AdminProjectsContentProps {
  initialProjects: Project[]
  initialStaff: Staff[]
}

export function AdminProjectsContent({ initialProjects, initialStaff }: AdminProjectsContentProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [staff] = useState<Staff[]>(initialStaff)
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

        await supabase.rpc("log_audit", {
          p_action: "update",
          p_entity_type: "project",
          p_entity_id: selectedProject.id,
          p_new_values: projectData,
        })

        toast.success("Project updated successfully")
      } else {
        const { error } = await supabase.from("projects").insert({
          ...projectData,
          created_by: user.id,
        })
        if (error) throw error

        await supabase.rpc("log_audit", {
          p_action: "create",
          p_entity_type: "project",
          p_entity_id: null,
          p_new_values: projectData,
        })

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

      await supabase.rpc("log_audit", {
        p_action: "delete",
        p_entity_type: "project",
        p_entity_id: projectToDelete.id,
        p_old_values: projectToDelete,
      })

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
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link
                href="/admin"
                aria-label="Back to admin"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
                <FolderKanban className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
                Project Management
              </h1>
            </div>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Create and manage projects</p>
          </div>
          <Button onClick={() => handleOpenProjectDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        </div>

        {/* Statistics Cards */}
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

        {/* Search and Filter */}
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
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{project.project_name}</CardTitle>
                        <Badge className={getStatusColor(project.status)}>{project.status.replace("_", " ")}</Badge>
                      </div>
                      {project.description && (
                        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/projects/${project.id}`}>
                        <Button variant="outline" size="sm">
                          Manage
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="outline" size="icon" onClick={() => handleOpenProjectDialog(project)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setProjectToDelete(project)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="text-muted-foreground text-xs">Location</p>
                        <p className="font-medium">{project.location}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="text-muted-foreground text-xs">Duration</p>
                        <p className="font-medium">
                          {formatDate(project.deployment_start_date)} - {formatDate(project.deployment_end_date)}
                        </p>
                      </div>
                    </div>

                    {project.project_manager && (
                      <div className="flex items-center gap-2">
                        <User className="text-muted-foreground h-4 w-4" />
                        <div>
                          <p className="text-muted-foreground text-xs">Project Manager</p>
                          <p className="font-medium">
                            {project.project_manager.first_name} {project.project_manager.last_name}
                          </p>
                        </div>
                      </div>
                    )}

                    {project.capacity_w && (
                      <div className="flex items-center gap-2">
                        <Package className="text-muted-foreground h-4 w-4" />
                        <div>
                          <p className="text-muted-foreground text-xs">Capacity</p>
                          <p className="font-medium">{project.capacity_w.toLocaleString()} W</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
                  searchPlaceholder="Search staff..."
                  icon={<User className="h-4 w-4" />}
                  options={[
                    { value: "none", label: "None" },
                    ...staff.map((member) => ({
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
      </div>
    </div>
  )
}
