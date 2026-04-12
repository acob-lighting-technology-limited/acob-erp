"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
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
import type { Task } from "@/types/task"
import {
  enrichTaskWithUsers,
  filterByDepartments,
  buildDepartmentLeadMap,
  applyTaskFilters,
  validateTaskForm,
  sendUpdateNotifications,
  sendCreateNotifications,
} from "./tasks-content-utils"
import {
  filterAssignableTaskDepartments,
  filterAssignableTaskUsers,
  hasGlobalTaskAssignmentAuthority,
} from "@/lib/tasks/assignment-scope"

const log = logger("tasks-management-admin-tasks-content")

export type { Task } from "@/types/task"

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
  is_global_task_assigner?: boolean
}

interface GoalFilterOption {
  id: string
  title: string
}

interface AdminTasksContentProps {
  initialTasks: Task[]
  initialemployee: employee[]
  initialDepartments: string[]
  initialGoals: GoalFilterOption[]
  userProfile: UserProfile
  initialGoalId?: string
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
  initialDepartments,
  initialGoals,
  userProfile,
  initialGoalId = "",
}: AdminTasksContentProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [employee] = useState<employee[]>(initialemployee)
  const assignerProfile = {
    id: userProfile.id,
    department: userProfile.department || null,
    is_department_lead: userProfile.is_department_lead ?? false,
    lead_departments: userProfile.lead_departments ?? [],
  }
  const activeEmployees = employee.filter((member) => isAssignableProfile(member, { allowLegacyNullStatus: false }))
  const scopedAssignableEmployees = filterAssignableTaskUsers(assignerProfile, activeEmployees)
  const [departments] = useState<string[]>(initialDepartments)
  const scopedAssignableDepartments = filterAssignableTaskDepartments(assignerProfile, departments)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [employeeFilter, setemployeeFilter] = useState("all")
  const [goalFilter, setGoalFilter] = useState(initialGoalId || "all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false)

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM)
  const consumedInitialGoalIdRef = useRef("")

  useEffect(() => {
    if (!initialGoalId || consumedInitialGoalIdRef.current === initialGoalId) return
    consumedInitialGoalIdRef.current = initialGoalId
    setSelectedTask(null)
    setTaskForm({ ...INITIAL_TASK_FORM, goal_id: initialGoalId })
    setIsTaskDialogOpen(true)
  }, [initialGoalId])

  const supabase = createClient()
  const scopedDepartments = userProfile.is_global_task_assigner
    ? []
    : (userProfile.managed_departments ?? userProfile.lead_departments ?? [])

  const loadData = async () => {
    try {
      let tasksQuery = supabase
        .from("tasks")
        .select("*")
        .neq("category", "weekly_action")
        .order("created_at", { ascending: false })
      if (userProfile?.is_department_lead && !userProfile.is_global_task_assigner && scopedDepartments.length > 0) {
        tasksQuery = tasksQuery.in("department", scopedDepartments)
      }
      const { data: tasksData, error: tasksError } = await tasksQuery
      if (tasksError) throw tasksError
      let result = await Promise.all((tasksData || []).map((task) => enrichTaskWithUsers(supabase, task)))
      if (userProfile?.is_department_lead && !userProfile.is_global_task_assigner && scopedDepartments.length > 0) {
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

      setTaskForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        assigned_to: task.assigned_to || "",
        department: task.department || "",
        due_date: task.due_date ? task.due_date.split("T")[0] : "",
        assignment_type: task.assignment_type || "individual",
        assigned_users: [],
        project_id: "",
        goal_id: task.goal_id || "",
        task_start_date: task.task_start_date || "",
        task_end_date: task.task_end_date || "",
      })
    } else {
      setSelectedTask(null)
      setTaskForm(INITIAL_TASK_FORM)
    }
    setIsTaskDialogOpen(true)
  }

  const handleSaveTask = async (nextTaskForm?: TaskFormState) => {
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

      const activeTaskForm = nextTaskForm ?? taskForm

      const validationError = validateTaskForm(activeTaskForm)
      if (validationError) {
        toast.error(validationError)
        setIsSaving(false)
        return
      }

      const taskData = {
        title: activeTaskForm.title,
        description: activeTaskForm.description || null,
        priority: activeTaskForm.priority,
        status: activeTaskForm.status,
        due_date: activeTaskForm.due_date || null,
        department:
          activeTaskForm.assignment_type === "department"
            ? activeTaskForm.department
            : activeTaskForm.department || null,
        assignment_type: activeTaskForm.assignment_type,
        assigned_to: activeTaskForm.assignment_type === "individual" ? activeTaskForm.assigned_to : null,
        assigned_by: user.id,
        goal_id: activeTaskForm.goal_id,
        task_start_date: null,
        task_end_date: null,
        source_type: "manual",
      }

      if (selectedTask) {
        const response = await fetch(`/api/tasks/${selectedTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to update task")
        await sendUpdateNotifications(activeTaskForm, selectedTask, user.id)
        toast.success(`${selectedTask.work_item_number || "Task"} updated`)
      } else {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string; data?: Task } | null
        if (!response.ok || !payload?.data) throw new Error(payload?.error || "Failed to create task")
        const newTask = payload.data
        await sendCreateNotifications(activeTaskForm, newTask, user.id)
        toast.success(`${newTask.work_item_number || "Task"} created`)
      }

      setIsTaskDialogOpen(false)
      setTaskForm(INITIAL_TASK_FORM)
      loadData()
    } catch (error: unknown) {
      log.error("Error saving task:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to save task: ${message}`)
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

      const response = await fetch(`/api/tasks/${taskToDelete.id}`, { method: "DELETE" })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to delete task")

      toast.success(`${taskToDelete.work_item_number || "Task"} deleted`)
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
    goalFilter,
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
    if (task.assignment_type === "department") {
      if (!task.department) return false
      if (managedDeptSet.size > 0) return managedDeptSet.has(task.department)
      return Boolean(userProfile.department && task.department === userProfile.department)
    }
    return task.assigned_to === userProfile.id
  })

  const workflowOwnerLabel = (task: Task) => {
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
          goalFilter={goalFilter}
          setGoalFilter={setGoalFilter}
          departments={departments}
          goals={initialGoals}
          activeEmployees={activeEmployees}
          userProfile={userProfile}
        />
      }
      filtersInCard={false}
    >
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
        showSerialNumber
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
        scopedAssignableEmployees={scopedAssignableEmployees}
        scopedAssignableDepartments={scopedAssignableDepartments}
        assignmentAuthorityLabel={
          hasGlobalTaskAssignmentAuthority(assignerProfile)
            ? "You can assign tasks across all departments."
            : "You can assign tasks only within your department."
        }
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
