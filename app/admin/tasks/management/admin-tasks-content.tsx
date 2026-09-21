"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { TASK_WEIGHT_DEFAULT, getTaskWeightBadgeClass } from "@/lib/tasks/scoring"
import { cn, formatName, formatFullName } from "@/lib/utils"
import { formatWATDate, formatWATDateTime, toLocalISODate } from "@/lib/utils/date"
import { isTaskOverdue } from "@/lib/tasks/overdue"
import {
  ClipboardList,
  Plus,
  ArrowRight,
  Pencil,
  Trash2,
  Calendar,
  User,
  Target,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Send,
  Users,
  FolderKanban,
  Download,
} from "lucide-react"
import { isAssignableProfile } from "@/lib/workforce/assignment-policy"
import { logger } from "@/lib/logger"
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog"
import type { TaskFormState } from "@/components/tasks/TaskFormDialog"
import { TaskDeleteDialog } from "@/components/tasks/TaskDeleteDialog"
import { TaskReviewDecisionDialog } from "@/components/tasks/TaskReviewDecisionDialog"
import { SELF_RATING_BLOCKED_REASON, isSelfRatingBlocked } from "@/lib/tasks/rating-authority"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter, DataTableTab } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Badge } from "@/components/ui/badge"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import type { Task } from "@/types/task"
import { apiFetch } from "@/lib/api-client"
import { filterByDepartments, validateTaskForm } from "./tasks-content-utils"
import { filterAssignableTaskDepartments, filterAssignableTaskUsers } from "@/lib/tasks/assignment-scope"
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/lib/tasks/constants"
import { AdminUserTasksPlan, type UserPlanExportContext } from "./admin-user-tasks-plan"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import {
  exportTaskListToExcel,
  exportTaskListToPdf,
  exportUserPlanToExcel,
  exportUserPlanToPdf,
  type TaskExportMeta,
} from "@/lib/tasks/export"

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
  /** Head of Executive Management; the only person who may rate their own tasks. */
  is_md?: boolean
}

interface ReviewCycleOption {
  id: string
  name: string
  review_type: string | null
  start_date: string | null
  end_date: string | null
  status?: string | null
}

interface GoalFilterOption {
  id: string
  title: string
}

interface AdminTasksContentProps {
  initialTasks: Task[]
  initialemployee: employee[]
  initialDepartments: string[]
  initialGoals?: GoalFilterOption[]
  initialReviewCycles?: ReviewCycleOption[]
  initialProjects?: Array<{ id: string; project_name: string }>
  userProfile: UserProfile
  initialGoalId?: string
}

export function AdminTaskStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = TASK_STATUS_CONFIG[status as TaskStatus] || TASK_STATUS_CONFIG.pending
  return (
    <Badge variant={cfg.badgeVariant} className={cn("text-[11px] whitespace-nowrap capitalize", cfg.color, className)}>
      {cfg.label}
    </Badge>
  )
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
  plan_id: "",
  goal_id: "",
  kpi_id: "",
  weight: TASK_WEIGHT_DEFAULT,
  task_start_date: "",
  task_end_date: "",
}

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted_for_review", label: "Submitted for Review" },
  { value: "completed", label: "Completed" },
  { value: "unable_to_complete", label: "Unable to Complete" },
  { value: "reassigned", label: "Reassigned" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

const TASK_TABS: DataTableTab[] = [
  { key: "tasks", label: "All Tasks", icon: ClipboardList },
  { key: "user_plan", label: "User Task Plan", icon: Users },
]

export function AdminTasksContent({
  initialTasks,
  initialemployee,
  initialDepartments,
  initialGoals = [],
  initialReviewCycles = [],
  initialProjects = [],
  userProfile,
  initialGoalId = "",
}: AdminTasksContentProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "user_plan">("tasks")
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [employee] = useState<employee[]>(initialemployee)
  const assignerProfile = {
    id: userProfile.id,
    role: userProfile.role,
    department: userProfile.department || null,
    is_department_lead: userProfile.is_department_lead ?? false,
    lead_departments: userProfile.lead_departments ?? [],
    isAdminLike: userProfile.is_global_task_assigner,
  }
  const activeEmployees = employee.filter((member) => isAssignableProfile(member, { allowLegacyNullStatus: true }))
  const scopedAssignableEmployees = filterAssignableTaskUsers(assignerProfile, activeEmployees)
  const assignableEmployees = scopedAssignableEmployees.length > 0 ? scopedAssignableEmployees : activeEmployees
  const [departments] = useState<string[]>(initialDepartments)
  const goals = useMemo(() => (Array.isArray(initialGoals) ? initialGoals : []), [initialGoals])
  const departmentOptions = useMemo(() => (Array.isArray(departments) ? departments : []), [departments])
  const scopedAssignableDepartments = filterAssignableTaskDepartments(assignerProfile, departments)
  const [isLoading, setIsLoading] = useState(false)

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [reviewTask, setReviewTask] = useState<Task | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  // Export reads exactly what each tab's table currently shows.
  const userPlanExportRef = useRef<UserPlanExportContext | null>(null)
  const [visibleTaskIds, setVisibleTaskIds] = useState<string[]>([])
  const [taskFilterValues, setTaskFilterValues] = useState<Record<string, string[]>>({})
  const [taskSearch, setTaskSearch] = useState("")
  const handleProcessedTasks = useCallback((rows: Task[]) => setVisibleTaskIds(rows.map((r) => r.id)), [])

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM)
  const consumedInitialGoalIdRef = useRef("")

  const scopedDepartments = userProfile.is_global_task_assigner
    ? []
    : (userProfile.managed_departments ?? userProfile.lead_departments ?? [])

  useEffect(() => {
    if (!initialGoalId || consumedInitialGoalIdRef.current === initialGoalId) return
    consumedInitialGoalIdRef.current = initialGoalId
    setSelectedTask(null)
    setTaskForm({ ...INITIAL_TASK_FORM, goal_id: initialGoalId, task_start_date: toLocalISODate() })
    setIsTaskDialogOpen(true)
  }, [initialGoalId])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch("/api/tasks", { cache: "no-store" })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load tasks")
      const json = await res.json()
      let result = (json.data || []) as Task[]
      if (userProfile?.is_department_lead && !userProfile.is_global_task_assigner && scopedDepartments.length > 0) {
        result = result.filter((task) => {
          if (task.assignment_type === "individual" && task.assigned_to === userProfile.id) return true
          return filterByDepartments([task], scopedDepartments).length > 0
        })
      }
      setTasks(result)
    } catch (error: unknown) {
      log.error("Error loading data:", error)
      toast.error("Failed to reload tasks")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenTaskDialog = (task?: Task) => {
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
        project_id: task.project_id || "",
        plan_id: task.plan_id || "",
        goal_id: task.goal_id || "",
        kpi_id: task.kpi_id || "",
        weight: task.weight ?? TASK_WEIGHT_DEFAULT,
        task_start_date: task.task_start_date ? task.task_start_date.split("T")[0] : "",
        task_end_date: task.task_end_date ? task.task_end_date.split("T")[0] : "",
      })
    } else {
      setSelectedTask(null)
      setTaskForm({ ...INITIAL_TASK_FORM, task_start_date: toLocalISODate() })
    }
    setIsTaskDialogOpen(true)
  }

  const handleOpenReviewDialog = (task: Task) => {
    setReviewTask(task)
    setIsReviewDialogOpen(true)
  }

  const handleSaveTask = async (nextTaskForm?: TaskFormState) => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const currentUserRes = await apiFetch("/api/admin/current-user", { cache: "no-store" })
      if (!currentUserRes.ok) {
        setIsSaving(false)
        return
      }
      const { userId } = (await currentUserRes.json()) as { userId: string }

      const activeTaskForm = nextTaskForm ?? taskForm
      const validationError = validateTaskForm(activeTaskForm)
      if (validationError) {
        toast.error(validationError)
        setIsSaving(false)
        return
      }

      // Shared by create and update, except status: a new task always starts
      // pending, but an existing one can only change status through
      // TaskStatusControl, which enforces the mandatory rating. The general
      // update route ignores a status field entirely now — sending one here
      // would just be a dead value implying a control that no longer exists.
      const baseTaskData = {
        title: activeTaskForm.title,
        description: activeTaskForm.description || null,
        priority: activeTaskForm.priority,
        due_date: activeTaskForm.due_date || null,
        department: activeTaskForm.department || null,
        assignment_type: activeTaskForm.assignment_type,
        assigned_to: activeTaskForm.assigned_to || null,
        assigned_users: activeTaskForm.assigned_users || [],
        assigned_by: userId,
        goal_id: activeTaskForm.goal_id || null,
        kpi_id: activeTaskForm.kpi_id || null,
        project_id: activeTaskForm.project_id || null,
        plan_id: activeTaskForm.plan_id || null,
        weight: activeTaskForm.weight,
        task_start_date: activeTaskForm.task_start_date || null,
        task_end_date: activeTaskForm.task_end_date || null,
        source_type: "manual",
      }

      if (selectedTask) {
        const response = await apiFetch(`/api/tasks/${selectedTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseTaskData),
        })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || "Failed to update task")
        // The assignee's notification and any deadline email are raised by the
        // PATCH route itself, so they survive this tab closing.
        toast.success(`${selectedTask.work_item_number || "Task"} updated`)
      } else {
        const response = await apiFetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseTaskData, status: "pending" }),
        })
        const payload = (await response.json().catch(() => null)) as {
          error?: string
          data?: Task
          createdCount?: number
        } | null
        if (!response.ok || !payload?.data) throw new Error(payload?.error || "Failed to create task")
        const newTask = payload.data
        const count = payload.createdCount || 1
        toast.success(
          count > 1 ? `${count} tasks created and assigned` : `${newTask.work_item_number || "Task"} created`
        )
      }

      setIsTaskDialogOpen(false)
      loadData()
    } catch (error: unknown) {
      log.error("Error saving task:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save task")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTask = async () => {
    if (!taskToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      const response = await apiFetch(`/api/tasks/${taskToDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to archive task")
      toast.success(`${taskToDelete.work_item_number || "Task"} archived`)
      setIsDeleteDialogOpen(false)
      setTaskToDelete(null)
      loadData()
    } catch (error: unknown) {
      log.error("Error archiving task:", error)
      toast.error("Failed to archive task")
    } finally {
      setIsDeleting(false)
    }
  }

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      submitted: tasks.filter((t) => t.status === "submitted_for_review").length,
      completed: tasks.filter((t) => t.status === "completed").length,
    }),
    [tasks]
  )

  const staffAvatars = useStaffAvatars()

  const workflowOwnerLabel = useCallback((task: Task) => {
    if (task.assigned_to_user) {
      return `${formatName(task.assigned_to_user.first_name)} ${formatName(task.assigned_to_user.last_name)}`
    }
    return "Unassigned"
  }, [])

  const columns: DataTableColumn<Task>[] = useMemo(
    () => [
      {
        key: "work_item_number",
        label: "Task ID",
        sortable: true,
        hideOnMobile: true,
        accessor: (r) => r.work_item_number || "",
        render: (r) => <span className="text-muted-foreground font-mono text-xs">{r.work_item_number || "—"}</span>,
      },
      {
        key: "title",
        label: "Task Title",
        sortable: true,
        resizable: true,
        initialWidth: 260,
        accessor: (r) => r.title,
        render: (r) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground font-medium">{r.title}</span>
            {r.project_name && (
              <span className="text-primary/80 inline-flex items-center gap-1 text-[10px] font-medium">
                <FolderKanban className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{r.project_name}</span>
              </span>
            )}
          </div>
        ),
      },
      {
        key: "assigned_to",
        label: "Assignee & Department",
        resizable: true,
        initialWidth: 200,
        accessor: (r) => `${workflowOwnerLabel(r)} ${r.department || ""}`,
        render: (r) => (
          <div className="flex items-center gap-2">
            {r.assigned_to_user && (
              <StaffAvatar
                name={workflowOwnerLabel(r)}
                src={r.assigned_to ? staffAvatars[r.assigned_to] : null}
                size="xs"
              />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground text-xs font-medium">{workflowOwnerLabel(r)}</span>
              <span className="text-muted-foreground text-[10px] uppercase">{r.department || "General"}</span>
            </div>
          </div>
        ),
      },
      {
        key: "weight",
        label: "Weight",
        sortable: true,
        accessor: (r) => r.weight ?? TASK_WEIGHT_DEFAULT,
        render: (r) => (
          <Badge variant="outline" className={cn("font-mono text-xs font-medium", getTaskWeightBadgeClass(r.weight))}>
            {r.weight ?? TASK_WEIGHT_DEFAULT}
          </Badge>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (r) => r.status,
        render: (r) => <AdminTaskStatusBadge status={r.status} />,
      },
      {
        key: "goal_title",
        label: "Strategic Goal",
        resizable: true,
        initialWidth: 220,
        hideOnMobile: true,
        accessor: (r) => r.goal_title || r.kpi_measure || "",
        render: (r) =>
          r.goal_title ? (
            <div className="flex flex-col">
              <span className="line-clamp-1 text-xs font-medium">{r.goal_title}</span>
              {r.kpi_measure && <span className="text-muted-foreground line-clamp-1 text-[10px]">{r.kpi_measure}</span>}
            </div>
          ) : r.kpi_measure ? (
            <span className="line-clamp-1 text-xs font-medium">{r.kpi_measure}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        key: "due_date",
        label: "Due Date",
        sortable: true,
        hideOnMobile: true,
        accessor: (r) => r.due_date || "",
        render: (r) => {
          const isOverdue = isTaskOverdue(r, toLocalISODate())
          return (
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="text-muted-foreground h-3.5 w-3.5" />
              <span className={isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}>
                {r.due_date ? formatWATDate(r.due_date) : "No Date"}
              </span>
              {isOverdue && <AlertTriangle className="text-destructive h-3 w-3" />}
            </div>
          )
        },
      },
    ],
    [workflowOwnerLabel, staffAvatars]
  )

  const filters: DataTableFilter<Task>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        options: STATUS_OPTIONS,
      },
      {
        key: "weight",
        label: "Weight",
        options: [
          { value: "1", label: "Weight 1" },
          { value: "2", label: "Weight 2" },
          { value: "3", label: "Weight 3" },
          { value: "4", label: "Weight 4" },
          { value: "5", label: "Weight 5" },
        ],
        mode: "custom",
        filterFn: (row, vals) => {
          if (vals.length === 0) return true
          return vals.includes(String(row.weight ?? TASK_WEIGHT_DEFAULT))
        },
      },
      {
        key: "kpi_status",
        label: "Corporate KPI",
        options: [
          { value: "needs_kpi", label: "Needs KPI" },
          { value: "linked", label: "Linked to KPI" },
        ],
        mode: "custom",
        filterFn: (row, vals) => {
          if (vals.length === 0) return true
          const hasKpi = Boolean(row.kpi_id)
          if (vals.includes("needs_kpi") && !hasKpi) return true
          if (vals.includes("linked") && hasKpi) return true
          return false
        },
      },
      {
        key: "department",
        label: "Department",
        options: departmentOptions.map((d) => ({ value: d, label: d })),
      },
    ],
    [departmentOptions]
  )

  const exportedBy = useMemo(() => {
    const me = employee.find((e) => e.id === userProfile.id)
    return me ? formatFullName(me.first_name, me.last_name) || undefined : undefined
  }, [employee, userProfile.id])

  const handleExport = (optionId: string) => {
    if (activeTab === "user_plan") {
      const ctx = userPlanExportRef.current
      if (!ctx || ctx.rows.length === 0) {
        toast.error("No employees to export for the current filters")
        return
      }
      const meta: TaskExportMeta = { ...ctx.meta, generatedBy: exportedBy }
      if (optionId === "excel") void exportUserPlanToExcel(ctx.rows, meta)
      else void exportUserPlanToPdf(ctx.rows, meta, { includeTasks: optionId === "pdf_detail" })
      return
    }

    const byId = new Map(tasks.map((t) => [t.id, t]))
    const rows = visibleTaskIds.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t))
    if (rows.length === 0) {
      toast.error("No tasks to export for the current filters")
      return
    }
    const labelFor = (key: string, value: string) =>
      filters.find((f) => f.key === key)?.options?.find((o) => o.value === value)?.label ?? value
    const filterSummary = filters
      .filter((f) => taskFilterValues[f.key]?.length)
      .map((f) => `${f.label}: ${taskFilterValues[f.key].map((v) => labelFor(f.key, v)).join(", ")}`)
    if (taskSearch.trim()) filterSummary.push(`Search: "${taskSearch.trim()}"`)
    const meta: TaskExportMeta = { filters: filterSummary, generatedBy: exportedBy }
    if (optionId === "excel") void exportTaskListToExcel(rows, workflowOwnerLabel, meta)
    else void exportTaskListToPdf(rows, workflowOwnerLabel, meta)
  }

  return (
    <DataTablePage
      title={activeTab === "user_plan" ? "User Task Plan & Workload" : "Task Management"}
      description={
        activeTab === "user_plan"
          ? "User-level task workload, period filters, weight points, and appraisal ratings."
          : "Operational task tracking, multi-user assignment, and PMS review governance."
      }
      icon={activeTab === "user_plan" ? Users : ClipboardList}
      backLink={{ href: "/admin", label: "Back to Admin" }}
      tabs={TASK_TABS}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as "tasks" | "user_plan")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsWorkflowOpen(true)} className="h-8 gap-2">
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">Workflow Guide</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)} className="h-8 gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button onClick={() => handleOpenTaskDialog()} className="h-8 gap-2" size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Task</span>
          </Button>
        </div>
      }
      stats={
        activeTab === "tasks" ? (
          <StatGrid>
            <StatCard
              variant="compact"
              title="Total Tasks"
              value={stats.total}
              icon={ClipboardList}
              iconBgColor="bg-blue-500/10"
              iconColor="text-blue-500"
            />
            <StatCard
              variant="compact"
              title="Pending"
              value={stats.pending}
              icon={Clock}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-500"
            />
            <StatCard
              variant="compact"
              title="In Progress"
              value={stats.inProgress}
              icon={ArrowRight}
              iconBgColor="bg-sky-500/10"
              iconColor="text-sky-500"
            />
            <StatCard
              variant="compact"
              title="Submitted"
              value={stats.submitted}
              icon={Send}
              iconBgColor="bg-purple-500/10"
              iconColor="text-purple-500"
            />
            <StatCard
              variant="compact"
              title="Completed"
              value={stats.completed}
              icon={CheckCircle2}
              iconBgColor="bg-emerald-500/10"
              iconColor="text-emerald-500"
            />
          </StatGrid>
        ) : undefined
      }
    >
      <ExportOptionsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        title={activeTab === "user_plan" ? "Export User Task Plan" : "Export Tasks"}
        options={
          activeTab === "user_plan"
            ? [
                { id: "excel", label: "Excel (Summary + Tasks)", icon: "excel" },
                { id: "pdf", label: "PDF (Summary)", icon: "pdf" },
                { id: "pdf_detail", label: "PDF (Summary + Tasks)", icon: "pdf" },
              ]
            : [
                { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
                { id: "pdf", label: "PDF", icon: "pdf" },
              ]
        }
        onSelect={handleExport}
      />

      {activeTab === "user_plan" ? (
        <AdminUserTasksPlan
          tasks={tasks}
          employees={assignableEmployees}
          departments={departmentOptions}
          cycles={initialReviewCycles}
          userProfile={userProfile}
          onOpenTaskDialog={handleOpenTaskDialog}
          onOpenReviewDialog={handleOpenReviewDialog}
          exportContextRef={userPlanExportRef}
        />
      ) : (
        <DataTable<Task>
          data={tasks}
          columns={columns}
          getRowId={(r) => r.id}
          pagination={{ pageSize: 50 }}
          isLoading={isLoading}
          onRetry={loadData}
          searchPlaceholder="Search task title, description, or assigned user..."
          searchFn={(r, q) =>
            `${r.title} ${r.description || ""} ${workflowOwnerLabel(r)} ${r.department || ""} ${r.work_item_number || ""}`
              .toLowerCase()
              .includes(q.toLowerCase())
          }
          filters={filters}
          onFilterValuesChange={setTaskFilterValues}
          onSearchChange={setTaskSearch}
          onProcessedDataChange={handleProcessedTasks}
          rowActions={[
            {
              label: "Review / Decision",
              icon: ShieldCheck,
              onClick: handleOpenReviewDialog,
            },
            { label: "Edit Task", icon: Pencil, onClick: handleOpenTaskDialog },
            {
              label: "Archive Task",
              icon: Trash2,
              variant: "destructive",
              onClick: (r) => {
                setTaskToDelete(r)
                setIsDeleteDialogOpen(true)
              },
            },
          ]}
          expandable={{
            render: (r) => (
              <div className="grid grid-cols-1 gap-6 p-5 text-xs md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Description & Scope
                  </h4>
                  <div className="bg-muted/40 rounded-lg border p-3 leading-relaxed whitespace-pre-wrap">
                    {r.description || "No description provided."}
                  </div>

                  {r.unable_to_complete_reason && (
                    <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-300">
                      <span className="mb-0.5 block font-semibold">Reported Blocker / Issue:</span>
                      {r.unable_to_complete_reason}
                    </div>
                  )}

                  {r.failure_reason && (
                    <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-800 dark:text-rose-300">
                      <span className="mb-0.5 block font-semibold">Failure Note:</span>
                      {r.failure_reason}
                    </div>
                  )}

                  {r.extension_reason && (
                    <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5 text-blue-800 dark:text-blue-300">
                      <span className="mb-0.5 block font-semibold">Extension Reason:</span>
                      {r.extension_reason}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Attribution & Lifecycle
                  </h4>
                  <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-lg border p-3">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Assigned To:</span>
                      <span className="flex items-center gap-1.5 font-medium">
                        {r.assigned_to_user && (
                          <StaffAvatar
                            name={workflowOwnerLabel(r)}
                            src={r.assigned_to ? staffAvatars[r.assigned_to] : null}
                            size="xs"
                          />
                        )}
                        {workflowOwnerLabel(r)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Assigned By:</span>
                      <span className="flex items-center gap-1.5 font-medium">
                        {r.assigned_by_user && (
                          <StaffAvatar
                            name={formatFullName(r.assigned_by_user.first_name, r.assigned_by_user.last_name)}
                            src={r.assigned_by ? staffAvatars[r.assigned_by] : null}
                            size="xs"
                          />
                        )}
                        {r.assigned_by_user
                          ? formatFullName(r.assigned_by_user.first_name, r.assigned_by_user.last_name)
                          : "System"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Created At:</span>
                      <span>{formatWATDateTime(r.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Due Date:</span>
                      <span className="font-medium">{r.due_date ? formatWATDate(r.due_date) : "No deadline"}</span>
                    </div>
                    {r.reviewed_by_user && (
                      <div className="col-span-2 border-t pt-1">
                        <span className="text-muted-foreground block text-[10px]">Reviewed By:</span>
                        <span className="font-medium">
                          {formatFullName(r.reviewed_by_user.first_name, r.reviewed_by_user.last_name)}
                          {r.reviewed_at && ` on ${formatWATDateTime(r.reviewed_at)}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => handleOpenReviewDialog(r)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Review & Take Action
                    </Button>
                  </div>
                </div>
              </div>
            ),
          }}
          viewToggle
          contactsView
          stickyToolbar
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            title: (r) => r.title,
            subtitle: (r) => {
              const parts = [
                r.work_item_number || null,
                workflowOwnerLabel(r),
                `Weight ${r.weight ?? TASK_WEIGHT_DEFAULT}`,
                r.due_date ? `Due ${formatWATDate(r.due_date)}` : "No deadline",
                r.kpi_measure || r.goal_title || null,
              ].filter(Boolean)
              return parts.join(" · ")
            },
            trailing: (r) => <AdminTaskStatusBadge status={r.status} className="text-[10px]" />,
            detail: {
              title: (r) => r.title,
              subtitle: (r) => r.work_item_number || undefined,
              badges: (r) => (
                <>
                  <AdminTaskStatusBadge status={r.status} className="text-[10px]" />
                  <Badge
                    variant="outline"
                    className={cn("font-mono text-[10px] font-medium", getTaskWeightBadgeClass(r.weight))}
                  >
                    Weight {r.weight ?? TASK_WEIGHT_DEFAULT}
                  </Badge>
                </>
              ),
              fields: (r) => [
                { label: "Item #", value: r.work_item_number || "-", copyable: true },
                { label: "Owner", value: workflowOwnerLabel(r) },
                { label: "Department", value: r.department || "-" },
                { label: "Status", value: formatName(r.status) },
                { label: "Task Weight", value: `${r.weight ?? TASK_WEIGHT_DEFAULT} (compulsory)` },
                {
                  label: "Corporate KPI",
                  value: r.kpi_measure ? `${r.kpi_measure}${r.kpi_pillar ? ` (🎯 ${r.kpi_pillar})` : ""}` : "—",
                },
                { label: "Strategic Goal", value: r.goal_title || "—" },
                { label: "Project", value: r.project_name || "—" },
                { label: "Start Date", value: r.task_start_date ? formatWATDate(r.task_start_date) : "—" },
                { label: "Due Date", value: r.due_date ? formatWATDate(r.due_date) : "No deadline" },
                { label: "Description", value: r.description || null, fullWidth: true },
              ],
              actions: (r) => [
                {
                  label: "Review / Manage Task",
                  onClick: () => handleOpenReviewDialog(r),
                },
              ],
            },
          }}
          cardRenderer={(r) => (
            <div className="bg-card group relative space-y-3 rounded-xl border p-4 text-xs transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="text-muted-foreground font-mono text-[10px]">{r.work_item_number}</span>
                <Badge
                  variant="outline"
                  className={cn("font-mono text-[10px] font-medium", getTaskWeightBadgeClass(r.weight))}
                >
                  Weight {r.weight ?? TASK_WEIGHT_DEFAULT}
                </Badge>
              </div>
              <div>
                <h4 className="line-clamp-1 text-sm font-semibold">{r.title}</h4>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{r.description}</p>
              </div>
              {r.kpi_measure && (
                <div className="text-muted-foreground line-clamp-1 text-[11px]">🎯 {r.kpi_measure}</div>
              )}
              <div className="flex items-center justify-between border-t pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="max-w-[120px] truncate font-medium">{workflowOwnerLabel(r)}</span>
                </div>
                <AdminTaskStatusBadge status={r.status} className="text-[10px]" />
              </div>
            </div>
          )}
        />
      )}

      <TaskFormDialog
        isOpen={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        selectedTask={selectedTask}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        onSave={handleSaveTask}
        isSaving={isSaving}
        scopedAssignableEmployees={assignableEmployees}
        scopedAssignableDepartments={scopedAssignableDepartments}
        initialGoals={goals}
      />

      <TaskReviewDecisionDialog
        open={isReviewDialogOpen}
        onOpenChange={setIsReviewDialogOpen}
        task={reviewTask}
        assignableEmployees={assignableEmployees}
        ratingBlockedReason={
          reviewTask &&
          isSelfRatingBlocked({
            userId: userProfile.id,
            assigneeIds: [reviewTask.assigned_to],
          })
            ? SELF_RATING_BLOCKED_REASON
            : null
        }
        onSuccess={loadData}
      />

      <TaskDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteTask}
        isDeleting={isDeleting}
        taskToDelete={taskToDelete}
      />

      <Dialog open={isWorkflowOpen} onOpenChange={setIsWorkflowOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tasks & PMS Governance Guide</DialogTitle>
            <DialogDescription>
              Understanding task lifecycles, review governance, and KPI scoring impact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="bg-muted/20 space-y-1 rounded-lg border p-3">
              <p className="text-foreground font-semibold">1. Multi-Assignment & Individual Tasks</p>
              <p className="text-muted-foreground">
                When assigning a task to multiple team members, individual task instances are generated. Each employee
                has direct, separate accountability.
              </p>
            </div>
            <div className="bg-muted/20 space-y-1 rounded-lg border p-3">
              <p className="text-foreground font-semibold">2. Corporate KPI Alignment</p>
              <p className="text-muted-foreground">
                Every task is linked to an approved departmental Corporate KPI. The associated Strategic Goal and Pillar
                are automatically aligned and feed directly into performance reviews and scorecard progress.
              </p>
            </div>
            <div className="bg-muted/20 space-y-1 rounded-lg border p-3">
              <p className="text-foreground font-semibold">3. Lead Review & Weight Scoring</p>
              <p className="text-muted-foreground">
                Submitted tasks require lead/admin approval to reach Completed status and award KPI points based on task
                weight (1–5) and review rating. Blocked tasks can be reassigned (neutral for KPI), granted extensions,
                or marked failed.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DataTablePage>
  )
}
