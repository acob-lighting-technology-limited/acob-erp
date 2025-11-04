"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  ClipboardList,
  Calendar,
  User,
  MessageSquare,
  Send,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  progress: number
  due_date?: string
  started_at?: string
  completed_at?: string
  created_at: string
  assigned_by_user?: {
    first_name: string
    last_name: string
  }
  department?: string
}

interface TaskUpdate {
  id: string
  content?: string
  update_type: string
  created_at: string
  user?: {
    first_name: string
    last_name: string
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [newProgress, setNewProgress] = useState(0)
  const [newStatus, setNewStatus] = useState("")
  const supabase = createClient()

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    if (filterStatus === "all") {
      setFilteredTasks(tasks)
    } else {
      setFilteredTasks(tasks.filter((t) => t.status === filterStatus))
    }
  }, [filterStatus, tasks])

  const loadTasks = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *
        `)
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      
      // Fetch the assigned_by user details separately
      const tasksWithUsers = await Promise.all((data || []).map(async (task: any) => {
        if (task.assigned_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", task.assigned_by)
            .single()
          
          return {
            ...task,
            assigned_by_user: profile
          }
        }
        return task
      }))
      
      setTasks(tasksWithUsers as any || [])
      setFilteredTasks(tasksWithUsers as any || [])
    } catch (error: any) {
      console.error("Error loading tasks:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load tasks"
      toast.error(`Failed to load tasks: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTaskUpdates = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_updates")
        .select(`
          id,
          content,
          update_type,
          created_at,
          user:profiles!task_updates_user_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTaskUpdates(data as any || [])
    } catch (error) {
      console.error("Error loading task updates:", error)
    }
  }

  const openTaskDetails = async (task: Task) => {
    setSelectedTask(task)
    setNewProgress(task.progress)
    setNewStatus(task.status)
    await loadTaskUpdates(task.id)
    setIsDetailsOpen(true)
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return

    setIsSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: user.id,
        update_type: "comment",
        content: newComment,
      })

      if (error) throw error

      toast.success("Comment added")
      setNewComment("")
      await loadTaskUpdates(selectedTask.id)
    } catch (error) {
      console.error("Error adding comment:", error)
      toast.error("Failed to add comment")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateProgress = async () => {
    if (!selectedTask) return

    setIsSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const updates: any = { progress: newProgress }

      // Auto-update status based on progress
      if (newProgress === 0 && selectedTask.status === "pending") {
        // Keep as pending
      } else if (newProgress > 0 && newProgress < 100 && selectedTask.status === "pending") {
        updates.status = "in_progress"
        updates.started_at = new Date().toISOString()
      } else if (newProgress === 100) {
        updates.status = "completed"
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase.from("tasks").update(updates).eq("id", selectedTask.id)

      if (error) throw error

      // Log the update
      await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: user.id,
        update_type: "progress_update",
        content: `Progress updated to ${newProgress}%`,
        old_value: selectedTask.progress.toString(),
        new_value: newProgress.toString(),
      })

      toast.success("Progress updated")
      await loadTasks()
      setSelectedTask({ ...selectedTask, progress: newProgress, status: updates.status || selectedTask.status })
      await loadTaskUpdates(selectedTask.id)
    } catch (error) {
      console.error("Error updating progress:", error)
      toast.error("Failed to update progress")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTask) return

    setIsSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const updates: any = { status }
      if (status === "in_progress" && !selectedTask.started_at) {
        updates.started_at = new Date().toISOString()
      } else if (status === "completed") {
        updates.completed_at = new Date().toISOString()
        updates.progress = 100
      }

      const { error } = await supabase.from("tasks").update(updates).eq("id", selectedTask.id)

      if (error) throw error

      // Log the update
      await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: user.id,
        update_type: "status_change",
        content: `Status changed from ${selectedTask.status} to ${status}`,
        old_value: selectedTask.status,
        new_value: status,
      })

      toast.success("Status updated")
      await loadTasks()
      setSelectedTask({ ...selectedTask, status, ...updates })
      await loadTaskUpdates(selectedTask.id)
      setNewStatus(status)
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
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

  const getStatusColor = (status: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />
      case "in_progress":
        return <TrendingUp className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "cancelled":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getTaskStats = () => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
    }
  }

  const stats = getTaskStats()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              My Tasks
            </h1>
            <p className="text-muted-foreground mt-2">Track and manage your assigned tasks</p>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Tasks</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
                </div>
                <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pending</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">In Progress</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.in_progress}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Completed</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <Card
                key={task.id}
                className="border-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                onClick={() => openTaskDetails(task)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            {task.title}
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={getStatusColor(task.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(task.status)}
                            {task.status.replace("_", " ")}
                          </span>
                        </Badge>
                        <Badge className={getPriorityColor(task.priority)}>{task.priority} priority</Badge>
                        {task.department && <Badge variant="outline">{task.department}</Badge>}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold text-foreground">{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="h-2" />
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Due: {formatDate(task.due_date)}</span>
                          </div>
                        )}
                        {task.assigned_by_user && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>
                              By: {task.assigned_by_user.first_name} {task.assigned_by_user.last_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <ClipboardList className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {filterStatus === "all" ? "No Tasks Assigned" : `No ${filterStatus.replace("_", " ")} Tasks`}
              </h3>
              <p className="text-muted-foreground">
                {filterStatus === "all"
                  ? "You don't have any tasks assigned to you at the moment."
                  : "Try selecting a different filter to view other tasks."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Task Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedTask.title}</DialogTitle>
                <DialogDescription>{selectedTask.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Status and Priority */}
                <div className="flex gap-3 flex-wrap">
                  <Badge className={getStatusColor(selectedTask.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(selectedTask.status)}
                      {selectedTask.status.replace("_", " ")}
                    </span>
                  </Badge>
                  <Badge className={getPriorityColor(selectedTask.priority)}>{selectedTask.priority} priority</Badge>
                  {selectedTask.department && <Badge variant="outline">{selectedTask.department}</Badge>}
                </div>

                {/* Update Status */}
                <Card className="border bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Update Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={newStatus} onValueChange={handleUpdateStatus} disabled={isSaving}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Update Progress */}
                <Card className="border bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Update Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="font-semibold">{newProgress}%</span>
                      </div>
                      <Slider
                        value={[newProgress]}
                        onValueChange={(value) => setNewProgress(value[0])}
                        max={100}
                        step={5}
                        disabled={isSaving}
                      />
                    </div>
                    <Button
                      onClick={handleUpdateProgress}
                      disabled={isSaving || newProgress === selectedTask.progress}
                      className="w-full"
                    >
                      {isSaving ? "Updating..." : "Update Progress"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Add Comment */}
                <Card className="border bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Add Comment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment or update about this task..."
                      className="min-h-[100px]"
                    />
                    <Button onClick={handleAddComment} disabled={isSaving || !newComment.trim()} className="gap-2">
                      <Send className="h-4 w-4" />
                      Post Comment
                    </Button>
                  </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card className="border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Activity Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {taskUpdates.length > 0 ? (
                      <div className="space-y-4">
                        {taskUpdates.map((update) => (
                          <div key={update.id} className="flex gap-3 pb-4 border-b last:border-0">
                            <div className="flex-1">
                              {update.user && (
                                <p className="text-sm font-medium text-foreground">
                                  {update.user.first_name} {update.user.last_name}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">{update.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">{formatDateTime(update.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No updates yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
