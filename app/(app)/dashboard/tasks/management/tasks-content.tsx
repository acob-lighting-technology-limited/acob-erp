"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { StatCard } from "@/components/ui/stat-card"
import { ClipboardList, Clock, TrendingUp, CheckCircle2 } from "lucide-react"

import { UserTasksHeader } from "@/components/tasks/UserTasksHeader"
import { UserTaskTable } from "@/components/tasks/UserTaskTable"
import { UserTaskDetailsDialog } from "@/components/tasks/UserTaskDetailsDialog"
import { loadUserTasks } from "@/components/tasks/user-tasks-data"

const log = logger("dashboard-tasks-management-tasks-content")

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

export interface TaskUpdate {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const loaded = await loadUserTasks(supabase, userId, userProfile)
      setTasks(loaded)
      setFilteredTasks(loaded)
    } catch (error: unknown) {
      log.error("Error loading tasks:", error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error) || "Failed to load tasks"
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTaskUpdates((data as any) || [])
    } catch (error) {
      log.error("Error loading task updates:", error)
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
      log.error("Error adding comment:", error)
      toast.error("Failed to add comment")
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarkAsDone = async () => {
    if (!selectedTask || selectedTask.assignment_type !== "multiple") return

    setIsSaving(true)
    try {
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

      const { error } = await supabase.from("task_user_completion").insert({
        task_id: selectedTask.id,
        user_id: userId,
      })

      if (error) throw error

      await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: userId,
        update_type: "comment",
        content: "Marked task as done",
      })

      toast.success("You've marked this task as done")
      await loadTasks()
      await loadTaskUpdates(selectedTask.id)

      const updatedTask = tasks.find((t) => t.id === selectedTask.id)
      if (updatedTask) {
        setSelectedTask({ ...updatedTask, user_completed: true })
      }
    } catch (error) {
      log.error("Error marking task as done:", error)
      toast.error("Failed to mark task as done")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTask) return

    if (selectedTask.assignment_type === "department" && !selectedTask.can_change_status) {
      toast.error("Only department leads, admins, and super admins can change the status of department tasks")
      return
    }

    if (selectedTask.assignment_type === "multiple") {
      toast.error("For group tasks, please mark yourself as done instead of changing the status")
      return
    }

    setIsSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = { status }
      if (status === "in_progress" && !selectedTask.started_at) {
        updates.started_at = new Date().toISOString()
      } else if (status === "completed") {
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase.from("tasks").update(updates).eq("id", selectedTask.id)

      if (error) throw error

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
      log.error("Error updating status:", error)
      toast.error("Failed to update status")
    } finally {
      setIsSaving(false)
    }
  }

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen bg-gradient-to-br p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UserTasksHeader filterStatus={filterStatus} setFilterStatus={setFilterStatus} />

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard
            title="Total Tasks"
            value={stats.total}
            icon={ClipboardList}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={Clock}
            iconBgColor="bg-yellow-100 dark:bg-yellow-900/30"
            iconColor="text-yellow-600 dark:text-yellow-400"
          />
          <StatCard
            title="In Progress"
            value={stats.in_progress}
            icon={TrendingUp}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
        </div>

        <UserTaskTable filteredTasks={filteredTasks} filterStatus={filterStatus} onViewTask={openTaskDetails} />
      </div>

      <UserTaskDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        selectedTask={selectedTask}
        taskUpdates={taskUpdates}
        newComment={newComment}
        setNewComment={setNewComment}
        newStatus={newStatus}
        isSaving={isSaving}
        onAddComment={handleAddComment}
        onMarkAsDone={handleMarkAsDone}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  )
}
