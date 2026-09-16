"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  Loader2,
  Trash2,
  FolderTree,
  Scale,
  Star,
  Pencil,
  ChevronDown,
  ChevronRight,
  MoreVertical,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/api-client"
import { cn, formatFullName } from "@/lib/utils"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { TASK_STATUS_CONFIG, type TaskStatus } from "@/lib/tasks/constants"
import { TASK_WEIGHT_DEFAULT, computeProjectProgress } from "@/lib/tasks/scoring"
import { TaskFormDialog, type TaskFormState } from "@/components/tasks/TaskFormDialog"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"
import type { Task } from "@/types/task"
import type { Project } from "./project-admin-content"

type Plan = {
  id: string
  project_id: string
  name: string
  description: string | null
  sort_order: number
}

type ProjectTask = {
  id: string
  title: string
  description?: string | null
  priority?: string | null
  status: string
  weight: number | null
  rating: number | null
  plan_id: string | null
  due_date: string | null
  task_start_date?: string | null
  task_end_date?: string | null
  work_item_number?: string | null
  assigned_to?: string | null
  department?: string | null
  goal_id?: string | null
  kpi_id?: string | null
  assignment_type?: "individual" | "multiple" | "department" | null
  is_archived: boolean | null
  assigned_user?: { first_name: string | null; last_name: string | null } | null
}

const EMPTY_TASK_FORM: TaskFormState = {
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

export type ProjectPlanStaffOption = {
  id: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  department?: string | null
  company_email?: string | null
}

/**
 * Implementation plans and their tasks for one project.
 *
 * Tasks are created through the same dialog department leads use, with the
 * project and plan locked — there is no separate project-task form, because
 * there is no separate project-task table. One row, counted once.
 */
export function ProjectPlanBoard({
  project,
  profiles = [],
  readOnly = false,
}: {
  project: Project
  profiles?: ProjectPlanStaffOption[] | employee[]
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState({ name: "", description: "" })
  const [taskDialogPlan, setTaskDialogPlan] = useState<Plan | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM)
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({})

  const togglePlan = (id: string) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const plansKey = ["project-plans", project.id]
  const tasksKey = ["project-tasks", project.id]

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: plansKey,
    queryFn: async () => {
      const res = await apiFetch(`/api/projects/${project.id}/plans`, { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load plans")
      return payload.data
    },
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ProjectTask[]>({
    queryKey: tasksKey,
    queryFn: async () => {
      const res = await apiFetch(`/api/projects/${project.id}/tasks`, { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load tasks")
      return payload.data
    },
  })

  const addPlan = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const res = await apiFetch(`/api/projects/${project.id}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, sort_order: plans.length }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to add plan")
      return payload.data
    },
    onSuccess: () => {
      toast.success("Implementation plan added")
      setPlanForm({ name: "", description: "" })
      setIsAddPlanOpen(false)
      void queryClient.invalidateQueries({ queryKey: plansKey })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiFetch(`/api/projects/${project.id}/plans?plan_id=${planId}`, { method: "DELETE" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to delete plan")
      return payload.data
    },
    onSuccess: () => {
      toast.success("Plan removed. Its tasks were kept and are now ungrouped.")
      void queryClient.invalidateQueries({ queryKey: plansKey })
      void queryClient.invalidateQueries({ queryKey: tasksKey })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const tasksByPlan = useMemo(() => {
    const map = new Map<string, ProjectTask[]>()
    for (const task of tasks) {
      if (task.is_archived) continue
      const key = task.plan_id || ""
      const bucket = map.get(key) || []
      bucket.push(task)
      map.set(key, bucket)
    }
    return map
  }, [tasks])

  async function handleSaveTask(form: TaskFormState) {
    if (isSavingTask) return
    setIsSavingTask(true)
    try {
      if (editingTask) {
        const res = await apiFetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            priority: form.priority,
            due_date: form.due_date || null,
            department: form.department || null,
            assignment_type: form.assignment_type,
            assigned_to: form.assigned_to || null,
            goal_id: form.goal_id || null,
            kpi_id: form.kpi_id || null,
            project_id: project.id,
            plan_id: form.plan_id || null,
            weight: form.weight,
            task_start_date: form.task_start_date || null,
            task_end_date: form.task_end_date || null,
          }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || "Failed to update task")
        toast.success("Task updated")
      } else {
        const res = await apiFetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            priority: form.priority,
            status: "pending",
            due_date: form.due_date || null,
            department: form.department || null,
            assignment_type: form.assignment_type,
            assigned_to: form.assigned_to || null,
            assigned_users: form.assigned_users || [],
            goal_id: form.goal_id || null,
            kpi_id: form.kpi_id || null,
            project_id: project.id,
            plan_id: form.plan_id || null,
            weight: form.weight,
            task_start_date: form.task_start_date || null,
            task_end_date: form.task_end_date || null,
            source_type: "manual",
          }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || "Failed to create task")
        toast.success("Task added to the plan")
      }
      setIsTaskDialogOpen(false)
      setEditingTask(null)
      setTaskDialogPlan(null)
      void queryClient.invalidateQueries({ queryKey: tasksKey })
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task")
    } finally {
      setIsSavingTask(false)
    }
  }

  function openTaskDialog(plan: Plan | null) {
    setEditingTask(null)
    setTaskForm({
      ...EMPTY_TASK_FORM,
      project_id: project.id,
      plan_id: plan?.id ?? "",
      task_start_date: toLocalISODate(),
    })
    setTaskDialogPlan(plan)
    setIsTaskDialogOpen(true)
  }

  function openEditTaskDialog(task: ProjectTask) {
    const plan = plans.find((p) => p.id === task.plan_id) || null
    setEditingTask(task as unknown as Task)
    setTaskDialogPlan(plan)
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      status: task.status || "pending",
      assigned_to: task.assigned_to || "",
      department: task.department || "",
      due_date: task.due_date || "",
      assignment_type: (task.assignment_type as "individual" | "multiple" | "department") || "individual",
      assigned_users: task.assigned_to ? [task.assigned_to] : [],
      project_id: project.id,
      plan_id: task.plan_id || "",
      goal_id: task.goal_id || "",
      kpi_id: task.kpi_id || "",
      weight: task.weight ?? TASK_WEIGHT_DEFAULT,
      task_start_date: task.task_start_date || "",
      task_end_date: task.task_end_date || "",
    })
    setIsTaskDialogOpen(true)
  }

  function renderTaskRow(task: ProjectTask, index: number) {
    const config = TASK_STATUS_CONFIG[task.status as TaskStatus]
    return (
      <div
        key={task.id}
        onClick={readOnly ? undefined : () => openEditTaskDialog(task)}
        className={cn(
          "hover:bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm transition-colors",
          !readOnly && "group cursor-pointer"
        )}
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        onKeyDown={
          readOnly
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  openEditTaskDialog(task)
                }
              }
        }
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="text-muted-foreground w-6 shrink-0 pt-0.5 font-mono text-xs font-semibold">
            {index + 1}.
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={cn("truncate font-medium transition-colors", !readOnly && "group-hover:text-primary")}>
                {task.title}
              </p>
              {task.work_item_number && (
                <Badge variant="outline" className="text-muted-foreground shrink-0 px-1.5 py-0 font-mono text-[10px]">
                  {task.work_item_number}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {task.assigned_user
                ? formatFullName(task.assigned_user.first_name, task.assigned_user.last_name)
                : "Unassigned"}
              {task.task_end_date || task.due_date
                ? ` · due ${formatWATDate(task.task_end_date || task.due_date!)}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Scale className="h-3 w-3" />
            {task.weight ?? TASK_WEIGHT_DEFAULT}
          </Badge>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Star className="h-3 w-3" />
            {task.rating ? `${task.rating}/5` : "unrated"}
          </Badge>
          <Badge variant={config?.badgeVariant ?? "outline"} className={cn("text-[10px] capitalize", config?.color)}>
            {config?.label ?? task.status.replaceAll("_", " ")}
          </Badge>
          {!readOnly && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                openEditTaskDialog(task)
              }}
            >
              <Pencil className="h-3 w-3" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )}
        </div>
      </div>
    )
  }

  function renderGroup(key: string, title: string, description: string | null, plan: Plan | null) {
    const groupTasks = tasksByPlan.get(key) || []
    const progress = computeProjectProgress(groupTasks)
    const isExpanded = Boolean(expandedPlans[key])

    return (
      <div key={key || "ungrouped"} className="bg-background overflow-hidden rounded-lg border transition-all">
        <div
          role="button"
          tabIndex={0}
          onClick={() => togglePlan(key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              togglePlan(key)
            }
          }}
          className="hover:bg-muted/40 flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 transition-colors"
        >
          <div className="flex min-w-0 items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <FolderTree className="text-muted-foreground h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{title}</span>
                <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px] font-normal">
                  {groupTasks.length} {groupTasks.length === 1 ? "task" : "tasks"}
                </Badge>
              </div>
              {description && <p className="text-muted-foreground max-w-md truncate text-xs">{description}</p>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="w-28">
              <Progress value={progress.deliveryPct ?? 0} className="h-1.5" />
              <p className="text-muted-foreground mt-1 text-[10px]">
                {progress.deliveryPct ?? 0}% delivered · {progress.qualityPct ?? 0}% quality
              </p>
            </div>
            {!readOnly && plan && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
                    aria-label={`Options for ${plan.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    onClick={() => deletePlan.mutate(plan.id)}
                    disabled={deletePlan.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete plan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="bg-muted/10 border-t">
            {plan && (
              <div className="bg-background/50 flex items-center justify-between border-b px-3 py-2">
                <span className="text-muted-foreground text-xs font-medium">Tasks in {title}</span>
                {!readOnly && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTaskDialog(plan)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Task
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
                          aria-label={`Options for ${plan.name}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          onClick={() => deletePlan.mutate(plan.id)}
                          disabled={deletePlan.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete plan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}

            {groupTasks.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-muted-foreground mb-2 text-xs">No tasks in this plan yet.</p>
                {!readOnly && plan && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTaskDialog(plan)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add First Task
                  </Button>
                )}
              </div>
            ) : (
              <div>{groupTasks.map((task, idx) => renderTaskRow(task, idx))}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  const ungroupedCount = (tasksByPlan.get("") || []).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Implementation Plans</h4>
          <p className="text-muted-foreground text-xs">
            Workstreams and their assigned tasks. Delivery and health roll up automatically.
          </p>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPlanForm({ name: "", description: "" })
              setIsAddPlanOpen(true)
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Plan
          </Button>
        )}
      </div>

      {plansLoading || tasksLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading implementation plans...
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => renderGroup(plan.id, plan.name, plan.description, plan))}
          {ungroupedCount > 0 && renderGroup("", "Ungrouped tasks", "Project work not filed under a plan.", null)}
          {plans.length === 0 && ungroupedCount === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">
              No implementation plans yet. Add one to start breaking this project into tasks.
            </p>
          )}
        </div>
      )}

      <Dialog open={isAddPlanOpen} onOpenChange={setIsAddPlanOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!planForm.name.trim()) return
              addPlan.mutate({
                name: planForm.name.trim(),
                description: planForm.description.trim() || undefined,
              })
            }}
          >
            <DialogHeader>
              <DialogTitle>Add Implementation Plan</DialogTitle>
              <DialogDescription>Create a new plan phase or workstream for {project.project_name}.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="plan-name" className="text-xs font-medium">
                  Plan Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="plan-name"
                  value={planForm.name}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Civil Works, Electrical Rough-in, Procurement"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-description" className="text-xs font-medium">
                  Description <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="plan-description"
                  value={planForm.description}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Summary of scope, milestones, or deliverables for this plan..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddPlanOpen(false)}
                disabled={addPlan.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addPlan.isPending || !planForm.name.trim()}>
                {addPlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TaskFormDialog
        isOpen={isTaskDialogOpen}
        onOpenChange={(open) => {
          setIsTaskDialogOpen(open)
          if (!open) {
            setEditingTask(null)
            setTaskDialogPlan(null)
          }
        }}
        selectedTask={editingTask}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        onSave={handleSaveTask}
        isSaving={isSavingTask}
        scopedAssignableEmployees={profiles as employee[]}
        scopedAssignableDepartments={Array.from(new Set(profiles.map((p) => p.department).filter(Boolean) as string[]))}
        lockedProjectId={project.id}
        lockedProjectName={project.project_name}
        lockedPlanId={editingTask ? null : taskDialogPlan?.id || null}
        lockedPlanName={editingTask ? null : taskDialogPlan?.name || null}
      />
    </div>
  )
}
