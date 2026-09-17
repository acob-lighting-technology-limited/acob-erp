"use client"

import { useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Target, Users, User, Calendar, Scale, FolderKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ItemInfoButton } from "@/components/ui/item-info-button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/types/task"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"
import { formatFullName } from "@/lib/utils"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { TASK_WEIGHT_DEFAULT, TASK_WEIGHT_MAX, TASK_WEIGHT_MIN } from "@/lib/tasks/scoring"
import { statusLabel } from "@/components/tasks/TaskStatusControl"
import { latestTaskDeadline, TASK_MAX_WORKING_DAYS, taskDeadlineWindowError } from "@/lib/tasks/deadline-window"

interface GoalOption {
  id: string
  title: string
}

interface ProjectOption {
  id: string
  project_name: string
}

interface KpiOption {
  id: string
  measure: string
  perspective: string
  strategic_priority?: string
  strategic_objective: string
  role: "core" | "support"
}

const taskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  priority: z.string().default("medium"),
  status: z.string().default("pending"),
  assigned_to: z.string().optional(),
  department: z.string().optional(),
  due_date: z.string().optional(),
  assignment_type: z.enum(["individual", "multiple", "department"]).default("individual"),
  goal_id: z.string().optional().nullable(),
  kpi_id: z.string().min(1, "Corporate KPI is required"),
  project_id: z.string().optional().nullable(),
  plan_id: z.string().optional().nullable(),
  // Compulsory: this is the denominator of the assignee's KPI score.
  weight: z.coerce.number().int().min(TASK_WEIGHT_MIN).max(TASK_WEIGHT_MAX),
  task_start_date: z.string().optional(),
  task_end_date: z.string().optional(),
})

type TaskFormValues = z.infer<typeof taskFormSchema>

export interface TaskFormState {
  title: string
  description: string
  priority: string
  status: string
  assigned_to: string
  department: string
  due_date: string
  assignment_type: "individual" | "multiple" | "department"
  assigned_users: string[]
  project_id: string
  plan_id: string
  goal_id: string
  kpi_id: string
  weight: number
  task_start_date: string
  task_end_date: string
}

// Stable default: a fresh [] each render changes hook deps and can loop effects.
const EMPTY_GOALS: GoalOption[] = []

interface TaskFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedTask: Task | null
  taskForm: TaskFormState
  setTaskForm: (form: TaskFormState) => void
  onSave: (form: TaskFormState) => void
  isSaving: boolean
  scopedAssignableEmployees: employee[]
  scopedAssignableDepartments: string[]
  initialGoals?: GoalOption[]
  assignmentAuthorityLabel?: string
  /** Set when the form is opened from inside a project: the project is fixed. */
  lockedProjectId?: string | null
  lockedProjectName?: string | null
  /** Set when the form is opened from inside a plan. */
  lockedPlanId?: string | null
  lockedPlanName?: string | null
}

export function TaskFormDialog({
  isOpen,
  onOpenChange,
  selectedTask,
  taskForm,
  setTaskForm,
  onSave,
  isSaving,
  scopedAssignableEmployees,
  scopedAssignableDepartments,
  initialGoals = EMPTY_GOALS,
  assignmentAuthorityLabel,
  lockedProjectId = null,
  lockedProjectName = null,
  lockedPlanId = null,
  lockedPlanName = null,
}: TaskFormDialogProps) {
  const [kpiOptions, setKpiOptions] = useState<KpiOption[]>([])
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [isMultiAssign, setIsMultiAssign] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(() => new Set())

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority,
      status: taskForm.status,
      assigned_to: taskForm.assigned_to,
      department: taskForm.department,
      due_date: taskForm.due_date,
      assignment_type: taskForm.assignment_type,
      goal_id: taskForm.goal_id,
      kpi_id: taskForm.kpi_id,
      project_id: lockedProjectId || taskForm.project_id,
      plan_id: lockedPlanId || taskForm.plan_id,
      weight: taskForm.weight || TASK_WEIGHT_DEFAULT,
      task_start_date: taskForm.task_start_date || (!selectedTask ? toLocalISODate() : ""),
      task_end_date: taskForm.task_end_date,
    },
  })

  const {
    register,
    setValue,
    watch,
    getValues,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    if (!isOpen) return

    reset({
      title: taskForm.title,
      description: taskForm.description,
      priority: taskForm.priority || "medium",
      status: taskForm.status || "pending",
      assigned_to: taskForm.assigned_to || "",
      department: taskForm.department || "",
      due_date: taskForm.due_date || "",
      assignment_type: taskForm.assignment_type || "individual",
      goal_id: taskForm.goal_id || "",
      kpi_id: taskForm.kpi_id || "",
      project_id: lockedProjectId || taskForm.project_id || "",
      plan_id: lockedPlanId || taskForm.plan_id || "",
      weight: taskForm.weight || TASK_WEIGHT_DEFAULT,
      task_start_date: taskForm.task_start_date || (!selectedTask ? toLocalISODate() : ""),
      task_end_date: taskForm.task_end_date || "",
    })

    if (taskForm.assigned_users && taskForm.assigned_users.length > 1) {
      setIsMultiAssign(true)
      setSelectedUserIds(taskForm.assigned_users)
    } else if (taskForm.assigned_to) {
      setIsMultiAssign(false)
      setSelectedUserIds([taskForm.assigned_to])
    } else {
      setIsMultiAssign(false)
      setSelectedUserIds([])
    }
  }, [isOpen, reset, selectedTask, taskForm, lockedProjectId, lockedPlanId])

  const lockLevel = !selectedTask
    ? "none"
    : selectedTask.status === "pending"
      ? "none"
      : selectedTask.status === "in_progress" || selectedTask.status === "unable_to_complete"
        ? "partial"
        : "full"

  const assignedTo = watch("assigned_to")
  const departmentValue = watch("department")
  const kpiId = watch("kpi_id")
  const projectId = watch("project_id")
  const weightValue = watch("weight")
  const titleValue = watch("title")
  const statusValue = watch("status")
  const startDateValue = watch("task_start_date")
  const dueDateValue = watch("due_date")

  // New tasks only: the deadline may be at most five working days after the
  // start. Holidays extend the window, so they are loaded to match the server;
  // if they fail to load, the window is just weekends and the API has the final say.
  const isCreating = !selectedTask
  useEffect(() => {
    if (!isOpen || !isCreating) return
    fetch("/api/hr/leave/holidays", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload.data ?? []) as Array<{
          holiday_date: string
          location?: string
          is_business_day?: boolean
        }>
        setHolidays(
          new Set(
            rows
              .filter((row) => !row.is_business_day && (!row.location || ["all", "global"].includes(row.location)))
              .map((row) => row.holiday_date.slice(0, 10))
          )
        )
      })
      .catch(() => setHolidays(new Set()))
  }, [isOpen, isCreating])

  const effectiveStartDate = startDateValue || toLocalISODate()
  const maxDueDate = isCreating ? latestTaskDeadline(effectiveStartDate, holidays) : undefined
  const deadlineError =
    isCreating && dueDateValue
      ? taskDeadlineWindowError({ startIso: effectiveStartDate, dueIso: dueDateValue }, holidays)
      : null
  const isMissingDueDate = isCreating && !dueDateValue

  // Corporate KPIs a task may be tagged to: only the ones the target
  // department is CORE or SUPPORT on, per the RACI grid — not all 61.
  useEffect(() => {
    const targetDepartment =
      departmentValue ||
      scopedAssignableEmployees.find((e) => e.id === assignedTo)?.department ||
      scopedAssignableDepartments[0] ||
      ""

    if (!targetDepartment) {
      setKpiOptions([])
      return
    }

    fetch(`/api/corporate-scorecard/kpis?department=${encodeURIComponent(targetDepartment)}`)
      .then((res) => res.json())
      .then((payload) => setKpiOptions((payload.data ?? []) as KpiOption[]))
      .catch(() => setKpiOptions([]))
  }, [assignedTo, departmentValue, scopedAssignableDepartments, scopedAssignableEmployees])

  const selectedKpi = useMemo(() => kpiOptions.find((k) => k.id === kpiId), [kpiOptions, kpiId])

  useEffect(() => {
    if (!kpiId || !selectedKpi) return
    if (initialGoals && initialGoals.length > 0) {
      const match = initialGoals.find(
        (g) =>
          g.title.toLowerCase() === selectedKpi.strategic_objective.toLowerCase() ||
          g.title.toLowerCase().includes(selectedKpi.strategic_objective.toLowerCase()) ||
          selectedKpi.strategic_objective.toLowerCase().includes(g.title.toLowerCase())
      )
      if (match) {
        setValue("goal_id", match.id)
      }
    }
  }, [kpiId, selectedKpi, initialGoals, setValue])

  const sortedKpis = useMemo(() => {
    return [...kpiOptions].sort((a, b) => {
      if (a.role === "core" && b.role !== "core") return -1
      if (a.role !== "core" && b.role === "core") return 1
      return a.measure.localeCompare(b.measure)
    })
  }, [kpiOptions])

  // Projects are optional on a task, so a failed load must never block saving.
  useEffect(() => {
    if (!isOpen || lockedProjectId) return
    fetch("/api/projects", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) =>
        setProjectOptions(
          (payload.data ?? []).map((project: { id: string; project_name: string }) => ({
            id: project.id,
            project_name: project.project_name,
          }))
        )
      )
      .catch(() => setProjectOptions([]))
  }, [isOpen, lockedProjectId])

  const employeeSelectOptions = useMemo(() => {
    return scopedAssignableEmployees.map((member) => ({
      value: member.id,
      label: `${formatFullName(member.first_name, member.last_name)} (${member.department})`,
    }))
  }, [scopedAssignableEmployees])

  function buildTaskFormState(): TaskFormState {
    const values = getValues()
    const targetUsers = isMultiAssign ? selectedUserIds : values.assigned_to ? [values.assigned_to] : []
    const matchingGoalId = selectedKpi
      ? initialGoals.find(
          (g) =>
            g.title.toLowerCase() === selectedKpi.strategic_objective.toLowerCase() ||
            g.title.toLowerCase().includes(selectedKpi.strategic_objective.toLowerCase()) ||
            selectedKpi.strategic_objective.toLowerCase().includes(g.title.toLowerCase())
        )?.id ||
        values.goal_id ||
        ""
      : values.goal_id || ""

    return {
      title: values.title ?? "",
      description: values.description ?? "",
      priority: values.priority ?? "medium",
      status: values.status ?? "pending",
      assigned_to: targetUsers.length === 1 ? targetUsers[0] : "",
      department: values.department ?? "",
      due_date: values.due_date ?? "",
      assignment_type: targetUsers.length > 1 ? "multiple" : "individual",
      assigned_users: targetUsers,
      project_id: lockedProjectId || (values.project_id === "__none__" ? "" : (values.project_id ?? "")),
      plan_id: lockedPlanId || (values.plan_id ?? ""),
      weight: values.weight ?? TASK_WEIGHT_DEFAULT,
      goal_id: matchingGoalId,
      kpi_id: values.kpi_id === "__none__" ? "" : (values.kpi_id ?? ""),
      task_start_date: values.task_start_date ?? "",
      task_end_date: values.task_end_date ?? "",
    }
  }

  function handleSaveClick() {
    const nextTaskForm = buildTaskFormState()
    setTaskForm(nextTaskForm)
    onSave(nextTaskForm)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl min-w-0 overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{selectedTask ? "Edit Task" : "Create New Task"}</DialogTitle>
            <ItemInfoButton
              title="Task & KPI Guide"
              summary="Direct individual accountability with mandatory Corporate KPI alignment."
              details={[
                {
                  label: "Direct Assignment",
                  value:
                    "Assign tasks to a single person or multiple team members. When assigning to multiple people, individual task copies are created so each person is tracked independently.",
                },
                {
                  label: "Corporate KPI Alignment",
                  value:
                    "Every task must link to an approved Corporate KPI. The associated Department Goal and Strategic Pillar are automatically selected and aligned.",
                },
                {
                  label: "Review Workflow",
                  value:
                    "Employees submit completed tasks for review. Department leads and admins review and approve tasks to finalize KPI credit.",
                },
              ]}
            />
          </div>
          <DialogDescription>
            {selectedTask
              ? "Update task details, due dates, or linked Corporate KPI."
              : "Assign a task with Corporate KPI alignment to team members."}
          </DialogDescription>
          {assignmentAuthorityLabel ? (
            <p className="text-muted-foreground text-xs">{assignmentAuthorityLabel}</p>
          ) : null}
        </DialogHeader>

        {lockLevel === "full" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {statusLabel(selectedTask?.status || "")} work is locked. Use the status control to reopen it, or the review
            decision dialog to reassign it or extend its deadline.
          </div>
        )}
        {lockLevel === "partial" && (
          <div className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
            The assignee, weight and dates are locked once work is in progress — they&apos;re the terms this task is
            being scored against. Use Reassign or Extend Deadline in the review dialog to change them deliberately.
          </div>
        )}

        <fieldset disabled={lockLevel === "full"} className="w-full min-w-0 space-y-4 py-2 text-sm">
          <div>
            <Label htmlFor="title" className="text-xs font-semibold">
              Task Title *
            </Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="e.g. Prepare monthly revenue reconciliation report"
              className="mt-1"
            />
            {errors.title && <p className="text-destructive mt-1 text-xs">{errors.title.message}</p>}
          </div>

          <div>
            <Label htmlFor="description" className="text-xs font-semibold">
              Description
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Describe expected scope, deliverables, and instructions..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Status is not set here. It starts at "pending" for a new task and,
              for an existing one, is owned entirely by TaskStatusControl — the
              dropdown that enforces the mandatory rating on approval. This form
              used to offer "Completed" directly with no rating collected,
              which bypassed that rule completely. */}

          {/* Assignment Section */}
          <div className="bg-muted/20 space-y-3 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Users className="h-3.5 w-3.5" />
                Assignee Selection
              </Label>
              {!selectedTask && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={isMultiAssign ? "secondary" : "outline"}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      const nextMulti = !isMultiAssign
                      setIsMultiAssign(nextMulti)
                      if (!nextMulti) {
                        if (selectedUserIds.length > 0) {
                          const firstId = selectedUserIds[0]
                          setValue("assigned_to", firstId)
                          const member = scopedAssignableEmployees.find((e) => e.id === firstId)
                          if (member?.department) {
                            setValue("department", member.department)
                          }
                          setSelectedUserIds([firstId])
                        }
                      } else {
                        if (assignedTo && !selectedUserIds.includes(assignedTo)) {
                          setSelectedUserIds([assignedTo])
                        }
                      }
                    }}
                  >
                    {isMultiAssign ? "Multi-Assign Active" : "Enable Multi-Assign"}
                  </Button>
                </div>
              )}
            </div>

            {!isMultiAssign ? (
              <div>
                <SearchableSelect
                  value={assignedTo || ""}
                  onValueChange={(val) => {
                    const member = scopedAssignableEmployees.find((e) => e.id === val)
                    setValue("assigned_to", val)
                    if (member?.department) {
                      setValue("department", member.department)
                    }
                    setSelectedUserIds(val ? [val] : [])
                  }}
                  placeholder="Select a team member..."
                  searchPlaceholder="Search staff name or department..."
                  icon={<User className="h-3.5 w-3.5" />}
                  options={employeeSelectOptions}
                  disabled={lockLevel !== "none"}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <SearchableMultiSelect
                  label="Select Team Members"
                  icon={<Users className="h-3.5 w-3.5" />}
                  values={selectedUserIds}
                  options={employeeSelectOptions}
                  onChange={(vals) => {
                    setSelectedUserIds(vals)
                    if (vals.length === 1) {
                      setValue("assigned_to", vals[0])
                      const member = scopedAssignableEmployees.find((e) => e.id === vals[0])
                      if (member?.department) {
                        setValue("department", member.department)
                      }
                    } else {
                      setValue("assigned_to", "")
                    }
                  }}
                  placeholder="Select team members..."
                  searchPlaceholder="Search staff name or department..."
                  disabled={lockLevel !== "none"}
                />
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Individual tasks will be created for each chosen person.</span>
                  <span>
                    Selected: <span className="text-foreground font-medium">{selectedUserIds.length}</span> staff
                    member(s)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Weight — compulsory */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="weight" className="flex items-center gap-1.5 text-xs font-semibold">
                <Scale className="text-primary h-3.5 w-3.5" />
                Task Weight
              </Label>
              <Badge variant="outline" className="text-[10px]">
                Required
              </Badge>
            </div>
            <Select
              value={String(weightValue ?? TASK_WEIGHT_DEFAULT)}
              onValueChange={(val) => setValue("weight", Number(val))}
              disabled={lockLevel !== "none"}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a weight" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: TASK_WEIGHT_MAX - TASK_WEIGHT_MIN + 1 }, (_, i) => TASK_WEIGHT_MIN + i).map(
                  (value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px]">
              How much this task matters relative to the assignee&apos;s other work. A weight-4 task counts twice as
              much as a weight-2 one. Weights do not need to add up to anything.
            </p>
          </div>

          {/* Corporate KPI Linking Section */}
          <div className="w-full min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="kpi_id" className="flex items-center gap-1.5 text-xs font-semibold">
                <Target className="text-primary h-3.5 w-3.5" />
                Corporate KPI <span className="text-destructive">*</span>
              </Label>
            </div>
            <Select value={kpiId || ""} onValueChange={(val) => setValue("kpi_id", val)}>
              <SelectTrigger className="mt-1 w-full max-w-full min-w-0 overflow-hidden">
                <SelectValue placeholder="Select a Corporate KPI" />
              </SelectTrigger>
              <SelectContent>
                {sortedKpis.length === 0 ? (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">
                    No corporate KPIs are assigned to this department yet.
                  </div>
                ) : (
                  sortedKpis.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id}>
                      <span className="line-clamp-1">
                        {kpi.measure} ({kpi.role === "core" ? "Core" : "Support"})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedKpi && (
              <div className="bg-muted/30 border-muted-foreground/20 mt-2 space-y-1.5 rounded-md border p-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                    <Target className="text-primary h-3.5 w-3.5" />
                    Department Goal
                  </Label>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Auto-selected from KPI
                  </Badge>
                </div>
                <Input
                  value={selectedKpi.strategic_objective || "—"}
                  disabled
                  readOnly
                  className="bg-background/80 text-foreground h-8 cursor-not-allowed text-xs font-medium"
                />
                {selectedKpi.strategic_priority && (
                  <p className="text-muted-foreground text-[11px]">
                    🎯 Strategic Pillar:{" "}
                    <span className="text-foreground font-medium">{selectedKpi.strategic_priority}</span>
                  </p>
                )}
              </div>
            )}
            <p className="text-muted-foreground text-[11px]">
              Which corporate target this work serves. Every task must link to an approved Corporate KPI.
            </p>
          </div>

          {/* Project Linking Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="project_id" className="flex items-center gap-1.5 text-xs font-semibold">
                <FolderKanban className="text-primary h-3.5 w-3.5" />
                Project
              </Label>
              <Badge variant="secondary" className="text-[10px]">
                {lockedProjectId ? "Fixed" : "Optional"}
              </Badge>
            </div>
            {lockedProjectId ? (
              <div className="bg-muted/50 text-muted-foreground mt-1 rounded-md border px-3 py-2 text-xs">
                {lockedProjectName || "This project"}
                {lockedPlanName ? ` · ${lockedPlanName}` : ""}
              </div>
            ) : (
              <Select
                value={projectId || "__none__"}
                onValueChange={(val) => setValue("project_id", val === "__none__" ? "" : val)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a project (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground italic">None (not project work)</span>
                  </SelectItem>
                  {projectOptions.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-muted-foreground text-[11px]">
              A project task is rated by that project&apos;s manager, and counts toward the project&apos;s progress.
            </p>
          </div>

          {/* Timeline Section */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="task_start_date" className="flex items-center gap-1 text-xs font-semibold">
                <Calendar className="h-3 w-3" />
                Start Date
              </Label>
              <Input
                id="task_start_date"
                type="date"
                {...register("task_start_date")}
                disabled={lockLevel !== "none"}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="due_date" className="flex items-center gap-1 text-xs font-semibold">
                <Calendar className="h-3 w-3" />
                Due Date / Deadline
                {isCreating && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="due_date"
                required={isCreating}
                type="date"
                {...register("due_date")}
                min={isCreating ? effectiveStartDate : undefined}
                max={maxDueDate}
                disabled={lockLevel !== "none"}
                aria-invalid={Boolean(deadlineError)}
                aria-describedby={isCreating ? "due_date_hint" : undefined}
                className="mt-1 text-xs"
              />
              {isCreating && (
                <p
                  id="due_date_hint"
                  className={
                    deadlineError ? "text-destructive mt-1 text-[11px]" : "text-muted-foreground mt-1 text-[11px]"
                  }
                >
                  {deadlineError ??
                    `Within ${TASK_MAX_WORKING_DAYS} working days of the start date — latest ${formatWATDate(maxDueDate!)}.`}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={
              isSaving ||
              !titleValue ||
              Boolean(deadlineError) ||
              isMissingDueDate ||
              (isMultiAssign ? selectedUserIds.length === 0 : !assignedTo)
            }
          >
            {isSaving ? "Saving..." : selectedTask ? "Update Task" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
