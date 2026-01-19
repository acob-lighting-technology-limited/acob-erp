"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  FolderKanban,
  Calendar,
  MapPin,
  User,
  Users,
  Zap,
  ArrowLeft,
  MessageSquare,
  Send,
  Package,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pause,
} from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Project {
  id: string
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w?: number
  technology_type?: string
  description?: string
  status: string
  created_at: string
  project_manager?: {
    first_name: string
    last_name: string
    company_email: string
  }
  created_by_user?: {
    first_name: string
    last_name: string
  }
}

interface ProjectMember {
  id: string
  user: {
    first_name: string
    last_name: string
    company_email: string
    department: string
  }
  role: string
  assigned_at: string
}

interface ProjectItem {
  id: string
  item_name: string
  description?: string
  quantity: number
  unit?: string
  status: string
  notes?: string
}

interface ProjectUpdate {
  id: string
  content?: string
  update_type: string
  created_at: string
  user?: {
    first_name: string
    last_name: string
  }
}

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  progress: number
  due_date?: string
  task_start_date?: string
  task_end_date?: string
  assigned_to_user: {
    first_name: string
    last_name: string
  }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [items, setItems] = useState<ProjectItem[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (projectId) {
      loadProjectData()
    }
  }, [projectId])

  const loadProjectData = async () => {
    try {
      await Promise.all([loadProject(), loadMembers(), loadItems(), loadUpdates(), loadTasks()])
    } catch (error) {
      console.error("Error loading project data:", error)
      toast.error("Failed to load project data")
    }
  }

  const loadProject = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_manager:profiles!projects_project_manager_id_fkey (
          first_name,
          last_name,
          company_email
        ),
        created_by_user:profiles!projects_created_by_fkey (
          first_name,
          last_name
        )
      `
      )
      .eq("id", projectId)
      .single()

    if (error) throw error
    setProject(data as any)
  }

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("project_members")
      .select(
        `
        id,
        role,
        assigned_at,
        user:profiles!project_members_user_id_fkey (
          first_name,
          last_name,
          company_email,
          department
        )
      `
      )
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("assigned_at", { ascending: false })

    if (error) throw error
    setMembers((data as any) || [])
  }

  const loadItems = async () => {
    const { data, error } = await supabase
      .from("project_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (error) throw error
    setItems(data || [])
  }

  const loadUpdates = async () => {
    const { data, error } = await supabase
      .from("project_updates")
      .select(
        `
        id,
        content,
        update_type,
        created_at,
        user:profiles!project_updates_user_id_fkey (
          first_name,
          last_name
        )
      `
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (error) throw error
    setUpdates((data as any) || [])
  }

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        id,
        title,
        description,
        priority,
        status,
        progress,
        due_date,
        task_start_date,
        task_end_date,
        assigned_to_user:profiles!tasks_assigned_to_fkey (
          first_name,
          last_name
        )
      `
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (error) throw error
    setTasks((data as any) || [])
  }

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
      loadUpdates()
    } catch (error) {
      console.error("Error adding comment:", error)
      toast.error("Failed to add comment")
    } finally {
      setIsSaving(false)
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

  const getPriorityColor = (priority: string) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="mb-2 text-xl font-semibold">Project not found</h2>
          <p className="text-muted-foreground mb-4">
            The project you're looking for doesn't exist or you don't have access to it.
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.project_name}</h1>
            <Badge className={`${getStatusColor(project.status)} flex items-center gap-1`}>
              {getStatusIcon(project.status)}
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
        </div>
      </div>

      {/* Project Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MapPin className="text-muted-foreground h-5 w-5" />
              <p className="text-lg font-semibold">{project.location}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground h-5 w-5" />
              <div className="text-sm">
                <p className="font-semibold">{formatDate(project.deployment_start_date)}</p>
                <p className="text-muted-foreground">to {formatDate(project.deployment_end_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">Project Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="text-muted-foreground h-5 w-5" />
              <div className="text-sm">
                {project.project_manager ? (
                  <>
                    <p className="font-semibold">
                      {project.project_manager.first_name} {project.project_manager.last_name}
                    </p>
                    <p className="text-muted-foreground text-xs">{project.project_manager.company_email}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Not assigned</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Optional Fields */}
      {(project.capacity_w || project.technology_type) && (
        <div className="grid gap-4 md:grid-cols-2">
          {project.capacity_w && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground text-sm font-medium">Capacity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <p className="text-lg font-semibold">{project.capacity_w.toLocaleString()} W</p>
                </div>
              </CardContent>
            </Card>
          )}

          {project.technology_type && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground text-sm font-medium">Technology Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FolderKanban className="text-muted-foreground h-5 w-5" />
                  <p className="text-lg font-semibold">{project.technology_type}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tabs for different sections */}
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

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Members</CardTitle>
              <CardDescription>Team members assigned to this project</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">No members assigned to this project yet</div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                          <User className="text-primary h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {member.user.first_name} {member.user.last_name}
                          </p>
                          <p className="text-muted-foreground text-sm">{member.user.company_email}</p>
                          <p className="text-muted-foreground text-xs">{member.user.department}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Items</CardTitle>
              <CardDescription>Equipment and materials for this project</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">No items added to this project yet</div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <p className="font-medium">{item.item_name}</p>
                            <Badge className={getItemStatusColor(item.status)}>{item.status}</Badge>
                          </div>
                          {item.description && <p className="text-muted-foreground mb-2 text-sm">{item.description}</p>}
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              Quantity: <span className="text-foreground font-medium">{item.quantity}</span>
                              {item.unit && ` ${item.unit}`}
                            </span>
                          </div>
                          {item.notes && <p className="text-muted-foreground mt-2 text-xs">Note: {item.notes}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Tasks</CardTitle>
              <CardDescription>Tasks associated with this project</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">No tasks assigned to this project yet</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Link key={task.id} href={`/tasks`}>
                      <div className="hover:bg-accent cursor-pointer rounded-lg border p-3 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="font-medium">{task.title}</p>
                              <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                            </div>
                            {task.description && (
                              <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-muted-foreground">
                                Assigned to:{" "}
                                <span className="text-foreground font-medium">
                                  {task.assigned_to_user.first_name} {task.assigned_to_user.last_name}
                                </span>
                              </span>
                              {task.task_start_date && task.task_end_date && (
                                <span className="text-muted-foreground">
                                  {formatDate(task.task_start_date)} - {formatDate(task.task_end_date)}
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                Progress: <span className="text-foreground font-medium">{task.progress}%</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity & Comments</CardTitle>
              <CardDescription>Project updates and team communication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddComment} disabled={isSaving || !newComment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Activity Timeline */}
              <div className="space-y-4">
                {updates.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    No activity yet. Be the first to comment!
                  </div>
                ) : (
                  updates.map((update) => (
                    <div key={update.id} className="flex gap-3 rounded-lg border p-3">
                      <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                        <MessageSquare className="text-primary h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {update.user ? `${update.user.first_name} ${update.user.last_name}` : "Unknown User"}
                          </p>
                          <span className="text-muted-foreground text-xs">{formatDateTime(update.created_at)}</span>
                        </div>
                        {update.content && (
                          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{update.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
