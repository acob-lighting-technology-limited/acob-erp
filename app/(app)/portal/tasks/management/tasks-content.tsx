"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import {
  ClipboardList,
  Calendar,
  User,
  Users,
  Building2,
  MessageSquare,
  Send,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  due_date?: string
  started_at?: string
  completed_at?: string
  created_at: string
  assignment_type?: "individual" | "multiple" | "department"
  assigned_by?: string
  assigned_by_user?: {
    first_name: string
    last_name: string
  }
  department?: string
  assigned_users?: Array<{
    id: string
    first_name: string
    last_name: string
    completed?: boolean
  }>
  user_completed?: boolean
  can_change_status?: boolean
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

interface TasksContentProps {
  initialTasks: Task[]
  userId: string
  userProfile: any
}

export function TasksContent({ initialTasks, userId, userProfile }: TasksContentProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(initialTasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [newStatus, setNewStatus] = useState("")
  const supabase = createClient()

  useEffect(() => {
    if (filterStatus === "all") {
      setFilteredTasks(tasks)
    } else {
      setFilteredTasks(tasks.filter((t) => t.status === filterStatus))
    }
  }, [filterStatus, tasks])

  const loadTasks = async () => {
    try {
      // Load tasks assigned to user individually
      const { data: individualTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", userId)
        .eq("assignment_type", "individual")

      // Load tasks where user is in task_assignments (multiple-user tasks)
      const { data: assignments } = await supabase.from("task_assignments").select("task_id").eq("user_id", userId)

      const multipleTaskIds = assignments?.map((a: any) => a.task_id) || []
      const { data: multipleTasks } =
        multipleTaskIds.length > 0
          ? await supabase.from("tasks").select("*").in("id", multipleTaskIds).eq("assignment_type", "multiple")
          : { data: [] }

      // Load department tasks if user has a department
      const { data: departmentTasks } = userProfile?.department
        ? await supabase
            .from("tasks")
            .select("*")
            .eq("department", userProfile.department)
            .eq("assignment_type", "department")
        : { data: [] }

      // Combine all tasks and remove duplicates
      const allTasks = [...(individualTasks || []), ...(multipleTasks || []), ...(departmentTasks || [])]
      const uniqueTasks = Array.from(new Map(allTasks.map((t: any) => [t.id, t])).values())

      // Fetch assigned_by user details and additional info
      const tasksWithUsers = await Promise.all(
        (uniqueTasks || []).map(async (task: any) => {
          const taskData: any = { ...task }

          // Fetch assigned_by user
          if (task.assigned_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", task.assigned_by)
              .single()

            taskData.assigned_by_user = profile
          }

          // For multiple-user tasks, fetch all assigned users and completion status
          if (task.assignment_type === "multiple") {
            const { data: taskAssignments } = await supabase
              .from("task_assignments")
              .select("user_id")
              .eq("task_id", task.id)

            if (taskAssignments && taskAssignments.length > 0) {
              const userIds = taskAssignments.map((a: any) => a.user_id)
              const { data: userProfiles } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", userIds)

              // Check if current user has completed
              const { data: userCompletion } = await supabase
                .from("task_user_completion")
                .select("user_id")
                .eq("task_id", task.id)
                .eq("user_id", userId)
                .single()

              const completedUserIds = new Set(
                (await supabase.from("task_user_completion").select("user_id").eq("task_id", task.id)).data?.map(
                  (c: any) => c.user_id
                ) || []
              )

              taskData.assigned_users =
                userProfiles?.map((profile: any) => ({
                  ...profile,
                  completed: completedUserIds.has(profile.id),
                })) || []
              taskData.user_completed = !!userCompletion
            }
          }

          // For department tasks, check if user can change status
          if (task.assignment_type === "department") {
            const canChangeStatus =
              userProfile?.role === "admin" ||
              userProfile?.role === "super_admin" ||
              (userProfile?.role === "lead" && userProfile?.lead_departments?.includes(task.department))
            taskData.can_change_status = canChangeStatus
          }

          return taskData
        })
      )

      // Sort by created_at
      tasksWithUsers.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setTasks((tasksWithUsers as any) || [])
      setFilteredTasks((tasksWithUsers as any) || [])
    } catch (error: any) {
      console.error("Error loading tasks:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load tasks"
      toast.error(`Failed to load tasks: ${errorMessage}`)
    }
  }

  const loadTaskUpdates = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_updates")
        .select(
          `
          id,
          content,
          update_type,
          created_at,
          user:profiles!task_updates_user_id_fkey (
            first_name,
            last_name
          )
        `
        )
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTaskUpdates((data as any) || [])
    } catch (error) {
      console.error("Error loading task updates:", error)
    }
  }

  const openTaskDetails = async (task: Task) => {
    setSelectedTask(task)
    setNewStatus(task.status)
    await loadTaskUpdates(task.id)
    setIsDetailsOpen(true)
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return

    setIsSaving(true)
    try {
      const { error } = await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: userId,
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

  const handleMarkAsDone = async () => {
    if (!selectedTask || selectedTask.assignment_type !== "multiple") return

    setIsSaving(true)
    try {
      // Check if user is already marked as done
      const { data: existingCompletion } = await supabase
        .from("task_user_completion")
        .select("id")
        .eq("task_id", selectedTask.id)
        .eq("user_id", userId)
        .single()

      if (existingCompletion) {
        toast.info("You've already marked this task as done")
        return
      }

      // Mark user as done
      const { error } = await supabase.from("task_user_completion").insert({
        task_id: selectedTask.id,
        user_id: userId,
      })

      if (error) throw error

      // Log the update
      await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: userId,
        update_type: "comment",
        content: "Marked task as done",
      })

      toast.success("You've marked this task as done")
      await loadTasks()
      await loadTaskUpdates(selectedTask.id)

      // Reload selected task to update completion status
      const updatedTask = tasks.find((t) => t.id === selectedTask.id)
      if (updatedTask) {
        setSelectedTask({ ...updatedTask, user_completed: true })
      }
    } catch (error) {
      console.error("Error marking task as done:", error)
      toast.error("Failed to mark task as done")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTask) return

    // Check permissions for department tasks
    if (selectedTask.assignment_type === "department" && !selectedTask.can_change_status) {
      toast.error("Only department leads, admins, and super admins can change the status of department tasks")
      return
    }

    // Multiple-user tasks should use individual completion
    if (selectedTask.assignment_type === "multiple") {
      toast.error("For group tasks, please mark yourself as done instead of changing the status")
      return
    }

    setIsSaving(true)
    try {
      const updates: any = { status }
      if (status === "in_progress" && !selectedTask.started_at) {
        updates.started_at = new Date().toISOString()
      } else if (status === "completed") {
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase.from("tasks").update(updates).eq("id", selectedTask.id)

      if (error) throw error

      // Log the update
      await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: userId,
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

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
              <ClipboardList className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
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
                  <p className="text-muted-foreground text-sm font-medium">Total Tasks</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.total}</p>
                </div>
                <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Pending</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">In Progress</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.in_progress}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Completed</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        {filteredTasks.length > 0 ? (
          <Card className="border-2">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task, index) => (
                    <TableRow
                      key={task.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => openTaskDetails(task)}
                    >
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="bg-primary/10 rounded-lg p-2">
                            <ClipboardList className="text-primary h-4 w-4" />
                          </div>
                          <span className="text-foreground font-medium">{task.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(task.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(task.status)}
                            {task.status.replace("_", " ")}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        {task.assignment_type === "multiple" && (
                          <Badge variant="outline" className="flex w-fit items-center gap-1">
                            <Users className="h-3 w-3" />
                            Group
                          </Badge>
                        )}
                        {task.assignment_type === "department" && (
                          <Badge variant="outline" className="flex w-fit items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {task.department}
                          </Badge>
                        )}
                        {task.assignment_type === "individual" && (
                          <Badge variant="outline" className="flex w-fit items-center gap-1">
                            <User className="h-3 w-3" />
                            Individual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="text-muted-foreground h-3 w-3" />
                            <span>{formatDate(task.due_date)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.assigned_by_user ? (
                          <div className="flex items-center gap-1 text-sm">
                            <User className="text-muted-foreground h-3 w-3" />
                            <span>
                              {formatName(task.assigned_by_user.first_name)}{" "}
                              {formatName(task.assigned_by_user.last_name)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openTaskDetails(task)
                          }}
                          className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
                          title="View task details"
                        >
                          <Eye className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <ClipboardList className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedTask.title}</DialogTitle>
                <DialogDescription>{selectedTask.description}</DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Status and Priority */}
                <div className="flex flex-wrap gap-3">
                  <Badge className={getStatusColor(selectedTask.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(selectedTask.status)}
                      {selectedTask.status.replace("_", " ")}
                    </span>
                  </Badge>
                  <Badge className={getPriorityColor(selectedTask.priority)}>{selectedTask.priority} priority</Badge>
                  {selectedTask.department && <Badge variant="outline">{selectedTask.department}</Badge>}
                </div>

                {/* Group Task Info */}
                {selectedTask.assignment_type === "multiple" && selectedTask.assigned_users && (
                  <Card className="bg-muted/30 border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" />
                        Group Task - Assigned People
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        {selectedTask.assigned_users.map((user: any) => (
                          <div key={user.id} className="bg-background flex items-center justify-between rounded-md p-2">
                            <span className="text-sm">
                              {formatName(user.first_name)} {formatName(user.last_name)}
                            </span>
                            {user.completed ? (
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              >
                                Done
                              </Badge>
                            ) : (
                              <Badge variant="outline">In Progress</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="text-muted-foreground border-t pt-2 text-xs">
                        {selectedTask.assigned_users.filter((u: any) => u.completed).length} of{" "}
                        {selectedTask.assigned_users.length} completed
                      </div>
                      {!selectedTask.user_completed && (
                        <Button
                          onClick={handleMarkAsDone}
                          disabled={isSaving}
                          className="w-full gap-2"
                          variant="default"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Mark Myself as Done
                        </Button>
                      )}
                      {selectedTask.user_completed && (
                        <div className="rounded-md bg-green-100 p-2 text-center text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          ✓ You've marked this task as done
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Department Task Info */}
                {selectedTask.assignment_type === "department" && (
                  <Card className="bg-muted/30 border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-4 w-4" />
                        Department Task
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        This task is assigned to the <strong>{selectedTask.department}</strong> department.
                        {!selectedTask.can_change_status && (
                          <span className="mt-2 block text-xs text-yellow-600 dark:text-yellow-400">
                            Only department leads, admins, and super admins can change the status.
                          </span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Update Status */}
                <Card className="bg-muted/30 border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Update Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select
                      value={newStatus}
                      onValueChange={handleUpdateStatus}
                      disabled={
                        isSaving ||
                        selectedTask.assignment_type === "multiple" ||
                        (selectedTask.assignment_type === "department" && !selectedTask.can_change_status)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedTask.assignment_type === "multiple" && (
                      <p className="text-muted-foreground text-xs">
                        For group tasks, mark yourself as done above instead of changing the status.
                      </p>
                    )}
                    {selectedTask.assignment_type === "department" && !selectedTask.can_change_status && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        Only department leads, admins, and super admins can change the status of department tasks.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Add Comment */}
                <Card className="bg-muted/30 border">
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
                          <div key={update.id} className="flex gap-3 border-b pb-4 last:border-0">
                            <div className="flex-1">
                              {update.user && (
                                <p className="text-foreground text-sm font-medium">
                                  {update.user.first_name} {update.user.last_name}
                                </p>
                              )}
                              <p className="text-muted-foreground text-sm">{update.content}</p>
                              <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(update.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground py-4 text-center text-sm">No updates yet</p>
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
