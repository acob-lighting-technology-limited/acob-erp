"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FolderKanban, Plus } from "lucide-react"
import { dateValidation } from "@/lib/validation"
import type { Project, employee } from "./page"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { isAssignableProfile } from "@/lib/workforce/assignment-policy"
import { ProjectStatsCards } from "@/components/projects/project-stats-cards"
import { ProjectsFilterBar } from "@/components/projects/projects-filter-bar"
import { ProjectsTable } from "@/components/projects/projects-table"
import { ProjectFormDialog, type ProjectFormState } from "@/components/projects/project-form-dialog"
import { ProjectDeleteDialog } from "@/components/projects/project-delete-dialog"

import { logger } from "@/lib/logger"

const log = logger("projects-admin-projects-content")

interface AdminProjectsContentProps {
  initialProjects: Project[]
  initialemployee: employee[]
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

const EMPTY_FORM: ProjectFormState = {
  project_name: "",
  location: "",
  deployment_start_date: "",
  deployment_end_date: "",
  capacity_w: "",
  technology_type: "",
  project_manager_id: "",
  description: "",
  status: "planning",
}

export function AdminProjectsContent({ initialProjects, initialemployee }: AdminProjectsContentProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [employee] = useState<employee[]>(initialemployee)
  const activeEmployees = employee.filter((member) => isAssignableProfile(member, { allowLegacyNullStatus: false }))
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_FORM)

  const supabase = createClient()

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select(
          `*, project_manager:profiles!projects_project_manager_id_fkey (first_name, last_name),
          created_by_user:profiles!projects_created_by_fkey (first_name, last_name)`
        )
        .order("created_at", { ascending: false })

      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProjects((data as any) || [])
    } catch (error) {
      log.error("Error loading data:", error)
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
      setProjectForm(EMPTY_FORM)
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
        toast.success("Project updated successfully")
      } else {
        const { error } = await supabase.from("projects").insert({ ...projectData, created_by: user.id })
        if (error) throw error
        toast.success("Project created successfully")
      }

      setIsProjectDialogOpen(false)
      loadData()
    } catch (error) {
      log.error("Error saving project:", error)
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
      toast.success("Project deleted successfully")
      setIsDeleteDialogOpen(false)
      setProjectToDelete(null)
      loadData()
    } catch (error) {
      log.error("Error deleting project:", error)
      toast.error(`Failed to delete project: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsDeleting(false)
    }
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
      stats={<ProjectStatsCards stats={stats} />}
      filters={
        <ProjectsFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
      }
      filtersInCard={false}
    >
      <ProjectsTable
        projects={filteredProjects}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        formatDate={formatDate}
        onEdit={handleOpenProjectDialog}
        onDelete={(project) => {
          setProjectToDelete(project)
          setIsDeleteDialogOpen(true)
        }}
        onCreateNew={() => handleOpenProjectDialog()}
      />

      <ProjectFormDialog
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        isEditing={Boolean(selectedProject)}
        form={projectForm}
        onFormChange={setProjectForm}
        onSave={handleSaveProject}
        isSaving={isSaving}
        activeEmployees={activeEmployees}
      />

      <ProjectDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        projectName={projectToDelete?.project_name}
        onConfirm={handleDeleteProject}
        onCancel={() => setProjectToDelete(null)}
        isDeleting={isDeleting}
      />
    </AdminTablePage>
  )
}
