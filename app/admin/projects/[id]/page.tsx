"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
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
import { ArrowLeft, Users, Package, ClipboardList } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { PageLoader } from "@/components/ui/query-states"
import { ProjectSummaryCard } from "@/components/projects/project-summary-card"
import { MembersTab } from "@/components/projects/members-tab"
import { ItemsTab } from "@/components/projects/items-tab"
import { ProjectTasksTab } from "@/components/projects/project-tasks-tab"
import { AddMemberDialog, type MemberForm } from "@/components/projects/add-member-dialog"
import { ItemDialog, type ItemForm } from "@/components/projects/item-dialog"
import { ProjectFormDialog, type ProjectFormState } from "@/components/projects/project-form-dialog"
import { fetchAdminProjectDetail, type ProjectMember, type ProjectItem } from "@/components/projects/project-data"
import { dateValidation } from "@/lib/validation"

import { logger } from "@/lib/logger"

const log = logger("projects")

const EMPTY_PROJECT_FORM: ProjectFormState = {
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

const getItemStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    case "ordered":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    case "received":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "installed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

const getTaskStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

const getTaskPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

export default function AdminProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const queryClient = useQueryClient()

  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [memberForm, setMemberForm] = useState<MemberForm>({ user_id: "", role: "member" })

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ProjectItem | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)
  const [itemForm, setItemForm] = useState<ItemForm>({
    item_name: "",
    description: "",
    quantity: "1",
    unit: "",
    status: "pending",
    notes: "",
  })

  const [memberToDelete, setMemberToDelete] = useState<ProjectMember | null>(null)
  const [itemToDelete, setItemToDelete] = useState<ProjectItem | null>(null)

  const [isAddingMember, setIsAddingMember] = useState(false)
  const [isRemovingMember, setIsRemovingMember] = useState(false)
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isDeletingItem, setIsDeletingItem] = useState(false)

  const supabase = createClient()

  const { data: pageData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminProjectDetail(projectId),
    queryFn: () => fetchAdminProjectDetail(projectId),
    enabled: Boolean(projectId),
  })

  const project = pageData?.project ?? null
  const employees = pageData?.employees ?? []
  const members = pageData?.members ?? []
  const items = pageData?.items ?? []
  const tasks = pageData?.tasks ?? []

  const handleAddMember = async () => {
    if (isAddingMember) return
    if (!memberForm.user_id) {
      toast.error("Please select a employee member")
      return
    }
    if (members.some((m) => m.user_id === memberForm.user_id)) {
      toast.error("This member is already assigned to the project")
      return
    }
    setIsAddingMember(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_id: memberForm.user_id,
        role: memberForm.role,
        assigned_by: user.id,
      })
      if (error) throw error
      await supabase.from("project_updates").insert({
        project_id: projectId,
        user_id: user.id,
        update_type: "member_added",
        content: `Added member with role: ${memberForm.role}`,
      })
      toast.success("Member added successfully")
      setIsMemberDialogOpen(false)
      setMemberForm({ user_id: "", role: "member" })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProjectDetail(projectId) })
    } catch (error) {
      log.error("Error adding member:", error)
      toast.error("Failed to add member")
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToDelete || isRemovingMember) return
    setIsRemovingMember(true)
    try {
      const { error } = await supabase
        .from("project_members")
        .update({ is_active: false, removed_at: new Date().toISOString() })
        .eq("id", memberToDelete.id)
      if (error) throw error
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("project_updates").insert({
          project_id: projectId,
          user_id: user.id,
          update_type: "member_removed",
          content: `Removed ${memberToDelete.user.first_name} ${memberToDelete.user.last_name}`,
        })
      }
      toast.success("Member removed successfully")
      setMemberToDelete(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProjectDetail(projectId) })
    } catch (error) {
      log.error("Error removing member:", error)
      toast.error("Failed to remove member")
    } finally {
      setIsRemovingMember(false)
    }
  }

  const handleOpenItemDialog = (item?: ProjectItem) => {
    if (item) {
      setSelectedItem(item)
      setItemForm({
        item_name: item.item_name,
        description: item.description || "",
        quantity: item.quantity.toString(),
        unit: item.unit || "",
        status: item.status,
        notes: item.notes || "",
      })
    } else {
      setSelectedItem(null)
      setItemForm({ item_name: "", description: "", quantity: "1", unit: "", status: "pending", notes: "" })
    }
    setIsItemDialogOpen(true)
  }

  const handleOpenProjectDialog = () => {
    if (!project) return

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
    setIsProjectDialogOpen(true)
  }

  const handleSaveProject = async () => {
    if (!project) return
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

    setIsSavingProject(true)
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          project_name: projectForm.project_name,
          location: projectForm.location,
          deployment_start_date: projectForm.deployment_start_date,
          deployment_end_date: projectForm.deployment_end_date,
          capacity_w: projectForm.capacity_w ? parseFloat(projectForm.capacity_w) : null,
          technology_type: projectForm.technology_type || null,
          project_manager_id: projectForm.project_manager_id || null,
          description: projectForm.description || null,
          status: projectForm.status,
        })
        .eq("id", project.id)

      if (error) throw error

      toast.success("Project updated successfully")
      setIsProjectDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProjectDetail(projectId) })
    } catch (error) {
      log.error("Error updating project:", error)
      toast.error("Failed to update project")
    } finally {
      setIsSavingProject(false)
    }
  }

  const handleSaveItem = async () => {
    if (isSavingItem) return
    if (!itemForm.item_name) {
      toast.error("Please enter item name")
      return
    }
    setIsSavingItem(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const itemData = {
        item_name: itemForm.item_name,
        description: itemForm.description || null,
        quantity: parseInt(itemForm.quantity) || 1,
        unit: itemForm.unit || null,
        status: itemForm.status,
        notes: itemForm.notes || null,
      }
      if (selectedItem) {
        const { error } = await supabase.from("project_items").update(itemData).eq("id", selectedItem.id)
        if (error) throw error
        toast.success("Item updated successfully")
      } else {
        const { error } = await supabase
          .from("project_items")
          .insert({ ...itemData, project_id: projectId, created_by: user.id })
        if (error) throw error
        toast.success("Item added successfully")
      }
      setIsItemDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProjectDetail(projectId) })
    } catch (error) {
      log.error("Error saving item:", error)
      toast.error("Failed to save item")
    } finally {
      setIsSavingItem(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete || isDeletingItem) return
    setIsDeletingItem(true)
    try {
      const { error } = await supabase.from("project_items").delete().eq("id", itemToDelete.id)
      if (error) throw error
      toast.success("Item deleted successfully")
      setItemToDelete(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProjectDetail(projectId) })
    } catch (error) {
      log.error("Error deleting item:", error)
      toast.error("Failed to delete item")
    } finally {
      setIsDeletingItem(false)
    }
  }

  const availableEmployees = employees.filter((e) => !members.some((m) => m.user_id === e.id))

  if (isLoading) return <PageLoader />

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Project not found</h2>
          <Link href="/admin/projects">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title={project.project_name}
        description="Manage project members and items"
        backLink={{ href: "/admin/projects", label: "Back to Projects" }}
        actions={
          <Button variant="outline" onClick={handleOpenProjectDialog}>
            Edit Project
          </Button>
        }
      />

      <ProjectSummaryCard project={project} />

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items ({items.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks ({tasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <MembersTab
            members={members}
            projectManagerId={project.project_manager_id}
            onAddMember={() => setIsMemberDialogOpen(true)}
            onRemoveMember={setMemberToDelete}
          />
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <ItemsTab
            items={items}
            getItemStatusColor={getItemStatusColor}
            onAddItem={() => handleOpenItemDialog()}
            onEditItem={handleOpenItemDialog}
            onDeleteItem={setItemToDelete}
          />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <ProjectTasksTab
            tasks={tasks}
            members={members}
            projectId={projectId}
            canManageTasks
            taskLinkBase="/admin/tasks"
            getStatusColor={getTaskStatusColor}
            getPriorityColor={getTaskPriorityColor}
            formatDate={(value) => new Date(value).toLocaleDateString("en-US")}
            onTaskCreated={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProjectDetail(projectId) })}
          />
        </TabsContent>
      </Tabs>

      <AddMemberDialog
        open={isMemberDialogOpen}
        onOpenChange={setIsMemberDialogOpen}
        availableEmployees={availableEmployees}
        form={memberForm}
        onFormChange={setMemberForm}
        onSubmit={handleAddMember}
        isSubmitting={isAddingMember}
      />

      <ProjectFormDialog
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        isEditing
        form={projectForm}
        onFormChange={setProjectForm}
        onSave={handleSaveProject}
        isSaving={isSavingProject}
        activeEmployees={employees}
      />

      <ItemDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        isEditing={!!selectedItem}
        form={itemForm}
        onFormChange={setItemForm}
        onSubmit={handleSaveItem}
        isSubmitting={isSavingItem}
      />

      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {memberToDelete && `${memberToDelete.user.first_name} ${memberToDelete.user.last_name}`} from this
              project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingMember}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleRemoveMember}
              loading={isRemovingMember}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{itemToDelete?.item_name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingItem}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDeleteItem}
              loading={isDeletingItem}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
