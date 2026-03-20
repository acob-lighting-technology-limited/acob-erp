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

const log = logger("tasks-management-tasks-content")

export interface Task {
  id: string
  title: string
  description?: string
  work_item_number?: string
  priority: string
  status: string
  due_date?: string
  started_at?: string
  completed_at?: string
  created_at: string
  source_type?: "manual" | "help_desk" | "action_item" | "project_task"
  source_id?: string
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

type TaskUpdateRow = Omit<TaskUpdate, "user"> & {
  user?: Array<{ first_name: string; last_name: string }> | { first_name: string; last_name: string } | null
}

export interface TaskUserProfile {
  department?: string | null
  role?: string | null
  is_department_lead?: boolean | null
  lead_departments?: string[] | null
}

interface TasksContentProps {
  initialTasks: Task[]
  userId: string
  userProfile: TaskUserProfile | null
}

const FINAL_TASK_STATUSES = new Set(["completed", "cancelled", "archived", "closed"])

function isFinalTaskStatus(status: string | undefined) {
  return FINAL_TASK_STATUSES.has(String(status || "").toLowerCase())
}

function mapTaskStatusToHelpDeskStatus(task: Task, status: string): string {
  if (status === "completed") return "resolved"
  if (status === "in_progress") return "in_progress"
  if (status === "cancelled") return "cancelled"
  if (status === "pending") {
    return task.assignment_type === "department" ? "department_assigned" : "assigned"
  }
  return status
}

export function TasksContent({ initialTasks, userId, userProfile }: TasksContentProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(initialTasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [assignmentFilter, setAssignmentFilter] = useState("all")
  const [taskView, setTaskView] = useState<"ongoing" | "history">("ongoing")
  const [newStatus, setNewStatus] = useState("")
  const supabase = createClient()

  useEffect(() => {
    const scopedTasks = tasks.filter((task) =>
      taskView === "history" ? isFinalTaskStatus(task.status) : !isFinalTaskStatus(task.status)
    )
    const normalizedSearch = searchQuery.trim().toLowerCase()

    const nextFiltered = scopedTasks.filter((task) => {
      const matchesStatus = filterStatus === "all" || task.status === filterStatus
      const matchesAssignment = assignmentFilter === "all" || task.assignment_type === assignmentFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        task.title.toLowerCase().includes(normalizedSearch) ||
        task.description?.toLowerCase().includes(normalizedSearch) ||
        task.work_item_number?.toLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesAssignment && matchesSearch
    })

    setFilteredTasks(nextFiltered)
  }, [assignmentFilter, filterStatus, searchQuery, taskView, tasks])

  const loadTasks = async () => {
    try {
      const loaded = await loadUserTasks(supabase, userId, userProfile)
      setTasks(loaded)
      setFilteredTasks(loaded)
      return loaded
    } catch (error: unknown) {
      log.error("Error loading tasks:", error)
      const errorMessage = error instanceof Error ? error.message : String(error) || "Failed to load tasks"
      toast.error(`Failed to load tasks: ${errorMessage}`)
      return null
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
      const normalizedUpdates = ((data as TaskUpdateRow[] | null) || []).map((entry) => ({
        ...entry,
        user: Array.isArray(entry.user) ? entry.user[0] : entry.user || undefined,
      }))
      setTaskUpdates(normalizedUpdates)
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
      const statusNote = newComment.trim()
      const updates: Partial<Task> = { status }
      if (status === "in_progress" && !selectedTask.started_at) {
        updates.started_at = new Date().toISOString()
      } else if (status === "completed") {
        updates.completed_at = new Date().toISOString()
      }

      if (selectedTask.source_type === "help_desk" && selectedTask.source_id) {
        const response = await fetch(`/api/help-desk/tickets/${selectedTask.source_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: mapTaskStatusToHelpDeskStatus(selectedTask, status),
            status_note: statusNote || null,
          }),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error || "Failed to update linked help desk task")
        }
      } else {
        const { error } = await supabase.from("tasks").update(updates).eq("id", selectedTask.id)

        if (error) throw error
      }

      await supabase.from("task_updates").insert({
        task_id: selectedTask.id,
        user_id: userId,
        update_type: "status_change",
        content: statusNote
          ? `Status changed from ${selectedTask.status} to ${status}. Note: ${statusNote}`
          : `Status changed from ${selectedTask.status} to ${status}`,
        old_value: selectedTask.status,
        new_value: status,
      })

      toast.success("Status updated")
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === selectedTask.id ? { ...task, ...updates, status } : task))
      )
      const reloadedTasks = await loadTasks()
      const refreshedTask = reloadedTasks?.find((task) => task.id === selectedTask.id) || null
      setSelectedTask(refreshedTask || { ...selectedTask, status, ...updates })
      await loadTaskUpdates(selectedTask.id)
      setNewStatus(status)
      setNewComment("")
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
        <UserTasksHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          assignmentFilter={assignmentFilter}
          setAssignmentFilter={setAssignmentFilter}
          taskView={taskView}
          setTaskView={setTaskView}
        />

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
