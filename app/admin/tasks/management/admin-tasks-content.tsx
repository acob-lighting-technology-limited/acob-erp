"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { ClipboardList, Plus, List, LayoutGrid, ArrowRight } from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { isAssignableProfile } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog"
import type { TaskFormState } from "@/components/tasks/TaskFormDialog"
import { TaskDeleteDialog } from "@/components/tasks/TaskDeleteDialog"
import { TaskListView } from "@/components/tasks/TaskListView"
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar"
import { TaskWorkflowTabs } from "@/components/tasks/TaskWorkflowTabs"
import { TaskStatsCards } from "@/components/tasks/TaskStatsCards"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { ItemInfoButton } from "@/components/ui/item-info-button"
import {
  enrichTaskWithUsers,
  filterByDepartments,
  buildDepartmentLeadMap,
  applyTaskFilters,
  validateTaskForm,
  persistTaskUpdate,
  persistTaskCreate,
  sendUpdateNotifications,
  sendCreateNotifications,
} from "./tasks-content-utils"

const log = logger("tasks-management-admin-tasks-content")

export interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  assigned_to: string
  assigned_by: string
  department?: string
  due_date?: string
  project_id?: string
  task_start_date?: string
  task_end_date?: string
  created_at: string
  work_item_number?: string
  source_type?: "manual" | "help_desk" | "action_item" | "project_task"
  assignment_type?: "individual" | "multiple" | "department"
  assigned_to_user?: {
    first_name: string
    last_name: string
    department: string
  }
  assigned_users?: Array<{
    id: string
    first_name: string
    last_name: string
    department: string
    completed?: boolean
  }>
  project?: {
    project_name: string
  }
}

export interface employee {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
  employment_status?: string | null
  is_department_lead?: boolean
  lead_departments?: string[] | null
}

export interface UserProfile {
  id: string
  role: string
  department?: string | null
  is_department_lead?: boolean
  lead_departments?: string[]
  managed_departments?: string[]
}

export interface Project {
  id: string
  project_name: string
}

interface AdminTasksContentProps {
  initialTasks: Task[]
  initialemployee: employee[]
  initialProjects: Project[]
  initialDepartments: string[]
  userProfile: UserProfile
}

const INITIAL_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  priority: "medium",
  status: "pending",
  assigned_to: "",
  department: "",
  due_date: "",
  assignment_type: "individual",
  assigned_users: [],
  project_id: "",
  goal_id: "",
  task_start_date: "",
  task_end_date: "",
}

export function AdminTasksContent({
  initialTasks,
  initialemployee,
  initialProjects,
  initialDepartments,
  userProfile,
}: AdminTasksContentProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [employee] = useState<employee[]>(initialemployee)
  const activeEmployees = employee.filter((member) => isAssignableProfile(member, { allowLegacyNullStatus: false }))
  const [departments] = useState<string[]>(initialDepartments)
  const [projects] = useState<Project[]>(initialProjects)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setemployeeFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false)

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM)

  const supabase = createClient()
  const scopedDepartments = userProfile.managed_departments ?? userProfile.lead_departments ?? []

  const loadData = async () => {
    try {
      let tasksQuery: any = supabase
        .from("tasks")
        .select("*")
        .neq("category", "weekly_action")
        .order("created_at", { ascending: false })
      if (userProfile?.is_department_lead && scopedDepartments.length > 0) {
        tasksQuery = tasksQuery.in("department", scopedDepartments)
      }
      const { data: tasksData, error: tasksError } = await tasksQuery
      if (tasksError) throw tasksError
      let result: any[] = await Promise.all((tasksData || []).map((task: any) => enrichTaskWithUsers(supabase, task)))
      if (userProfile?.is_department_lead && scopedDepartments.length > 0) {
        result = filterByDepartments(result, scopedDepartments)
      }
      setTasks(result as Task[])
    } catch (error: unknown) {
      log.error("Error loading data:", error)
      toast.error("Failed to reload tasks")
    }
  }

  const handleOpenTaskDialog = async (task?: Task) => {
    if (task) {
      setSelectedTask(task)

      let assignedUsers: string[] = []
      if (task.assignment_type === "multiple" && task.id) {
        const { data: assignments } = await supabase.from("task_assignments").select("user_id").eq("task_id", task.id)
        assignedUsers = assignments?.map((a: any) => a.user_id) || []
      }

      setTaskForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        assigned_to: task.assigned_to || "",
        department: task.department || "",
        due_date: task.due_date ? task.due_date.split("T")[0] : "",
        assignment_type: task.assignment_type || "individual",
        assigned_users: assignedUsers,
        project_id: task.project_id || "",
        goal_id: (task as any).goal_id || "",
        task_start_date: task.task_start_date || "",
        task_end_date: task.task_end_date || "",
      })
    } else {
      setSelectedTask(null)
      setTaskForm(INITIAL_TASK_FORM)
    }
    setIsTaskDialogOpen(true)
  }

  const handleSaveTask = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsSaving(false)
        return
      }

      const validationError = validateTaskForm(taskForm)
      if (validationError) {
        toast.error(validationError)
        setIsSaving(false)
        return
      }

      const taskData: any = {
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        status: taskForm.status,
        due_date: taskForm.due_date || null,
        department: taskForm.assignment_type === "department" ? taskForm.department : taskForm.department || null,
        assignment_type: taskForm.assignment_type,
        assigned_to: taskForm.assignment_type === "individual" ? taskForm.assigned_to : null,
        assigned_by: user.id,
        project_id: taskForm.project_id || null,
        goal_id: taskForm.goal_id || null,
        task_start_date: taskForm.task_start_date || null,
        task_end_date: taskForm.task_end_date || null,
        source_type: taskForm.project_id ? "project_task" : "manual",
      }

      if (selectedTask) {
        await persistTaskUpdate(supabase, taskForm, selectedTask.id, user.id, taskData)
        await sendUpdateNotifications(taskForm, selectedTask, user.id)
        toast.success("Task updated successfully")
      } else {
        const newTask = await persistTaskCreate(supabase, taskForm, taskData)
        await sendCreateNotifications(taskForm, newTask, user.id)
        toast.success("Task created successfully")
      }

      setIsTaskDialogOpen(false)
      loadData()
    } catch (error: unknown) {
      log.error("Error saving task:", error)
      toast.error(`Failed to save task: ${(error as any)?.message || "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTask = async () => {
    if (!taskToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from("tasks").delete().eq("id", taskToDelete.id)
      if (error) throw error

      // Audit logging handled by database trigger

      toast.success("Task deleted successfully")
      setIsDeleteDialogOpen(false)
      setTaskToDelete(null)
      loadData()
    } catch (error: unknown) {
      log.error("Error deleting task:", error)
      toast.error("Failed to delete task")
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredTasks = applyTaskFilters(tasks, {
    searchQuery,
    statusFilter,
    priorityFilter,
    departmentFilter,
    employeeFilter,
    userProfile,
    scopedDepartments,
    employee,
  })

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  }

  const finalTaskStatuses = new Set(["completed", "cancelled", "archived", "closed"])
  const allPendingWorkflowTasks = tasks.filter(
    (task) => !finalTaskStatuses.has(String(task.status || "").toLowerCase())
  )
  const taskHistory = tasks.filter((task) => finalTaskStatuses.has(String(task.status || "").toLowerCase()))

  const managedDeptSet = new Set(scopedDepartments)
  const departmentLeadMap = buildDepartmentLeadMap(activeEmployees)

  const myTaskActionQueue = allPendingWorkflowTasks.filter((task) => {
    if (task.assignment_type === "multiple" && task.assigned_users) {
      return task.assigned_users.some((member) => member.id === userProfile.id && !member.completed)
    }
    if (task.assignment_type === "department") {
      if (!task.department) return false
      if (managedDeptSet.size > 0) return managedDeptSet.has(task.department)
      return Boolean(userProfile.department && task.department === userProfile.department)
    }
    return task.assigned_to === userProfile.id
  })

  const workflowOwnerLabel = (task: Task) => {
    if (task.assignment_type === "multiple" && task.assigned_users) {
      const names = task.assigned_users
        .map((member) => `${formatName(member.first_name)} ${formatName(member.last_name)}`.trim())
        .filter(Boolean)
      return names.length > 0 ? names.join(", ") : "Unassigned"
    }
    if (task.assignment_type === "department") {
      const dept = task.department || ""
      if (!dept) return "Department"
      const leads = departmentLeadMap.get(dept) || []
      if (leads.length === 0) return `${dept} Lead (Unassigned)`
      return leads.map((lead) => `${formatName(lead.first_name)} ${formatName(lead.last_name)}`.trim()).join(", ")
    }
    if (task.assigned_to_user)
      return `${formatName(task.assigned_to_user.first_name)} ${formatName(task.assigned_to_user.last_name)}`
    return "Unassigned"
  }

  return (
    <AdminTablePage
      title="Task Management"
      description="Manage one clear task list, then open workflow guidance only when you need it."
      icon={ClipboardList}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsWorkflowOpen(true)} className="gap-2">
            Workflow Guide
          </Button>
          <div className="flex items-center rounded-lg border p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-1 sm:gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="gap-1 sm:gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Card</span>
            </Button>
          </div>
          <Button onClick={() => handleOpenTaskDialog()} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Task</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      }
      stats={<TaskStatsCards stats={stats} />}
      filters={
        <TaskFilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          employeeFilter={employeeFilter}
          setEmployeeFilter={setemployeeFilter}
          departments={departments}
          activeEmployees={activeEmployees}
          userProfile={userProfile}
        />
      }
      filtersInCard={false}
    >
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Task workflow at a glance</div>
              <ItemInfoButton
                title="Task workflow guide"
                summary="Tasks can come from help desk, meetings, projects, or direct assignment, but they should still feel like one flow."
                details={[
                  {
                    label: "How to read this page",
                    value:
                      "The main list below is the working source of truth. Use it to search, edit, assign, and complete tasks.",
                  },
                  {
                    label: "Where the other queues went",
                    value:
                      "Pending queue, your action queue, and history are still available, but they now live under Workflow Guide so the page stays easier to understand.",
                  },
                  {
                    label: "What the info icon means",
                    value:
                      "Use the info icon on any task, help desk ticket, reference, project task, or leave item when you need a quick explanation of what it is and what should happen next.",
                  },
                ]}
              />
            </div>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Keep the main list as the place where work gets done. Open the workflow guide only when you want the queue
              breakdown or history view.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border px-4 py-3">
              <div className="text-muted-foreground text-xs uppercase">Pending Queue</div>
              <div className="mt-1 text-2xl font-semibold">{allPendingWorkflowTasks.length}</div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-muted-foreground text-xs uppercase">My Action Queue</div>
              <div className="mt-1 text-2xl font-semibold">{myTaskActionQueue.length}</div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-muted-foreground text-xs uppercase">History</div>
              <div className="mt-1 text-2xl font-semibold">{taskHistory.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <TaskListView
        filteredTasks={filteredTasks}
        viewMode={viewMode}
        onEdit={handleOpenTaskDialog}
        onDelete={(task) => {
          setTaskToDelete(task)
          setIsDeleteDialogOpen(true)
        }}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
      />

      <ResponsiveModal
        open={isWorkflowOpen}
        onOpenChange={setIsWorkflowOpen}
        title="Task Workflow Guide"
        description="Use this when you want to inspect queue ownership and completed history without crowding the main task manager."
        desktopClassName="max-w-6xl"
      >
        <div className="space-y-4">
          <div className="bg-muted/40 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
            <ArrowRight className="h-4 w-4" />
            Pending queue shows all live work, My Action Queue shows what needs your attention, and History shows
            finished or closed items.
          </div>
          <TaskWorkflowTabs
            allPendingWorkflowTasks={allPendingWorkflowTasks}
            myTaskActionQueue={myTaskActionQueue}
            taskHistory={taskHistory}
            workflowOwnerLabel={workflowOwnerLabel}
          />
        </div>
      </ResponsiveModal>

      <TaskFormDialog
        isOpen={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        selectedTask={selectedTask}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        onSave={handleSaveTask}
        isSaving={isSaving}
        activeEmployees={activeEmployees}
        departments={departments}
        projects={projects}
      />

      <TaskDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) setTaskToDelete(null)
        }}
        taskToDelete={taskToDelete}
        onConfirm={handleDeleteTask}
        isDeleting={isDeleting}
      />
    </AdminTablePage>
  )
}
