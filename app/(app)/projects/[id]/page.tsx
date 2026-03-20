"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  ArrowLeft,
  Users,
  Package,
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pause,
} from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { PageLoader } from "@/components/ui/query-states"
import { ProjectOverviewCards } from "@/components/projects/project-overview-cards"
import { ProjectMembersReadTab } from "@/components/projects/project-members-read-tab"
import { ProjectItemsReadTab } from "@/components/projects/project-items-read-tab"
import { ProjectTasksTab } from "@/components/projects/project-tasks-tab"
import { ProjectActivityTab } from "@/components/projects/project-activity-tab"
import {
  type ProjectDetailData,
  getProjectStatusColor,
  getProjectPriorityColor,
  getProjectItemStatusColor,
  formatProjectDate,
  formatProjectDateTime,
} from "@/components/projects/project-detail-helpers"
import { logger } from "@/lib/logger"

const log = logger("projects")

type ProjectPageQueryData = ProjectDetailData & {
  canManageTasks: boolean
}

async function fetchProjectData(projectId: string): Promise<ProjectPageQueryData> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  const [projectResult, currentMemberResult] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `*,
        project_manager:profiles!projects_project_manager_id_fkey (first_name, last_name, company_email),
        created_by_user:profiles!projects_created_by_fkey (first_name, last_name)`
      )
      .eq("id", projectId)
      .single(),
    supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ])

  if (projectResult.error || !projectResult.data) {
    throw new Error(projectResult.error?.message ?? "Failed to load project")
  }

  const canViewProject =
    projectResult.data.project_manager_id === user.id || projectResult.data.created_by === user.id || !!currentMemberResult.data

  if (!canViewProject) {
    throw new Error("Forbidden")
  }

  const [membersResult, itemsResult, updatesResult, tasksResult] = await Promise.allSettled([
    supabase
      .from("project_members")
      .select(
        `id, user_id, role, assigned_at,
        user:profiles!project_members_user_id_fkey (first_name, last_name, company_email, department)`
      )
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("assigned_at", { ascending: false }),
    supabase.from("project_items").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase
      .from("project_updates")
      .select(
        `id, content, update_type, created_at,
        user:profiles!project_updates_user_id_fkey (first_name, last_name)`
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select(
        `id, title, work_item_number, description, priority, status, progress, due_date, task_start_date, task_end_date,
        assigned_to_user:profiles!tasks_assigned_to_fkey (first_name, last_name)`
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ])

  const hasSecondaryError = [membersResult, itemsResult, updatesResult, tasksResult].some(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.error)
  )
  if (hasSecondaryError) {
    log.warn("Some project sections failed to load")
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    project: projectResult.data as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members: (membersResult.status === "fulfilled" ? (membersResult.value.data as any) : null) ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (itemsResult.status === "fulfilled" ? (itemsResult.value.data as any) : null) ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updates: (updatesResult.status === "fulfilled" ? (updatesResult.value.data as any) : null) ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: (tasksResult.status === "fulfilled" ? (tasksResult.value.data as any) : null) ?? [],
    canManageTasks:
      projectResult.data.project_manager_id === user.id ||
      projectResult.data.created_by === user.id ||
      currentMemberResult.data?.role === "lead",
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "planning":
      return <Clock className="h-3 w-3" />
    case "active":
      return <CheckCircle2 className="h-3 w-3" />
    case "on_hold":
      return <Pause className="h-3 w-3" />
    case "completed":
      return <CheckCircle2 className="h-3 w-3" />
    case "cancelled":
      return <AlertCircle className="h-3 w-3" />
    default:
      return <Clock className="h-3 w-3" />
  }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const queryClient = useQueryClient()

  const [newComment, setNewComment] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()

  const { data: projectData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.appProjectDetail(projectId),
    queryFn: () => fetchProjectData(projectId),
    enabled: Boolean(projectId),
  })

  const project = projectData?.project ?? null
  const members = projectData?.members ?? []
  const items = projectData?.items ?? []
  const updates = projectData?.updates ?? []
  const tasks = projectData?.tasks ?? []
  const canManageTasks = Boolean(projectData?.canManageTasks)

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setIsSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase.from("project_updates").insert({
        project_id: projectId,
        user_id: user.id,
        update_type: "comment",
        content: newComment,
      })
      if (error) throw error

      toast.success("Comment added successfully")
      setNewComment("")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appProjectDetail(projectId) })
    } catch (error) {
      log.error("Error adding comment:", error)
      toast.error("Failed to add comment")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <PageLoader />

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold">Project not found</h2>
          <p className="text-muted-foreground mb-4">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link href="/projects">
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
        description={project.description || "Project details and progress"}
        backLink={{ href: "/projects", label: "Back to Projects" }}
        actions={
          <Badge className={`${getProjectStatusColor(project.status)} flex items-center gap-1`}>
            {getStatusIcon(project.status)}
            {project.status.replace("_", " ")}
          </Badge>
        }
      />

      <ProjectOverviewCards
        location={project.location}
        deploymentStartDate={project.deployment_start_date}
        deploymentEndDate={project.deployment_end_date}
        projectManager={project.project_manager}
        capacityW={project.capacity_w}
        technologyType={project.technology_type}
        formatDate={formatProjectDate}
      />

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
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <ProjectMembersReadTab members={members} />
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <ProjectItemsReadTab items={items} getItemStatusColor={getProjectItemStatusColor} />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <ProjectTasksTab
            tasks={tasks}
            members={members}
            projectId={projectId}
            canManageTasks={canManageTasks}
            getStatusColor={getProjectStatusColor}
            getPriorityColor={getProjectPriorityColor}
            formatDate={formatProjectDate}
            onTaskCreated={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appProjectDetail(projectId) })}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ProjectActivityTab
            updates={updates}
            newComment={newComment}
            isSaving={isSaving}
            onCommentChange={setNewComment}
            onAddComment={handleAddComment}
            formatDateTime={formatProjectDateTime}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
