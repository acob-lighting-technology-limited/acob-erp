"use client"

import { useEffect, useState, useMemo, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Users, User } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Task } from "@/types/task"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"
import { formatFullName } from "@/lib/utils"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { TASK_WEIGHT_DEFAULT, TASK_WEIGHT_MAX, TASK_WEIGHT_MIN } from "@/lib/tasks/scoring"
import { statusLabel } from "@/components/tasks/TaskStatusControl"
import { latestTaskDeadline, TASK_MAX_WORKING_DAYS, taskDeadlineWindowError } from "@/lib/tasks/deadline-window"
import { useQuery } from "@tanstack/react-query"
import { apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { fetchProjectRecords, PROJECTS_QUERY_KEY } from "@/lib/projects/records"
import { usePortfolios } from "@/hooks/use-portfolios"
import { portfolioLabel } from "@/lib/tasks/work-links"
import { describeSchedule, upcomingDueDates } from "@/lib/tasks/recurrence"
import { TaskRepeatFields } from "@/components/tasks/task-repeat-fields"
import { TaskWorkLinkField } from "@/components/tasks/task-work-link-field"
import { DEFAULT_REPEAT_FIELDS, scheduleFromForm, type RepeatFormFields } from "@/lib/tasks/series-client"

interface ProjectOption {
  id: string
  project_name: string
  status?: string
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
  assignment_type: z.enum(["individual", "multiple"]).default("individual"),
  goal_id: z.string().optional().nullable(),
  kpi_id: z.string().min(1, "Corporate KPI is required"),
  project_id: z.string().optional().nullable(),
  plan_id: z.string().optional().nullable(),
  portfolio_id: z.string().optional().nullable(),
  // Compulsory: this is the denominator of the assignee's KPI score.
  weight: z.coerce.number().int().min(TASK_WEIGHT_MIN).max(TASK_WEIGHT_MAX),
  task_start_date: z.string().optional(),
  task_end_date: z.string().optional(),
})

type TaskFormValues = z.infer<typeof taskFormSchema>

/** The repeat fields are optional, so a form built without them is a one-off task. */
export interface TaskFormState extends RepeatFormFields {
  title: string
  description: string
  priority: string
  status: string
  assigned_to: string
  department: string
  due_date: string
  assignment_type: "individual" | "multiple"
  assigned_users: string[]
  project_id: string
  /** Portfolio-wide work; only ever set when project_id is not. */
  portfolio_id: string
  plan_id: string
  goal_id: string
  kpi_id: string
  weight: number
  task_start_date: string
  task_end_date: string
}

/** A blank form for a new task. Callers spread it and set what they fix (project, plan, portfolio). */
export const EMPTY_TASK_FORM: TaskFormState = {
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
  portfolio_id: "",
  plan_id: "",
  goal_id: "",
  kpi_id: "",
  weight: TASK_WEIGHT_DEFAULT,
  task_start_date: "",
  task_end_date: "",
  ...DEFAULT_REPEAT_FIELDS,
}

// Stable default: a fresh [] each render changes hook deps and can loop effects.
const EMPTY_PROJECTS: ProjectOption[] = []

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
  initialProjects?: ProjectOption[]
  assignmentAuthorityLabel?: string
  /** Set when the form is opened from inside a project: the project is fixed. */
  lockedProjectId?: string | null
  lockedProjectName?: string | null
  /** Set when the form is opened from inside a plan. */
  lockedPlanId?: string | null
  lockedPlanName?: string | null
  /** Set when the form is opened from inside a portfolio: the task is portfolio-wide work. */
  lockedPortfolioId?: string | null
  lockedPortfolioName?: string | null
}

const NO_HOLIDAYS: ReadonlySet<string> = new Set()

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  )
}
const NO_KPIS: KpiOption[] = []

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
  initialProjects = EMPTY_PROJECTS,
  assignmentAuthorityLabel,
  lockedProjectId = null,
  lockedProjectName = null,
  lockedPlanId = null,
  lockedPlanName = null,
  lockedPortfolioId = null,
  lockedPortfolioName = null,
}: TaskFormDialogProps) {
  // New tasks use the checkbox list (tick one person or several); an
  // existing task belongs to one person, so editing keeps a single picker.
  const isMultiAssign = !selectedTask
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  // Recurrence is creation-only: an existing repeat is managed from its series.
  const [repeat, setRepeat] = useState<Required<RepeatFormFields>>(DEFAULT_REPEAT_FIELDS)

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
      portfolio_id: lockedPortfolioId || (lockedProjectId ? "" : taskForm.portfolio_id),
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
      portfolio_id: lockedPortfolioId || (lockedProjectId ? "" : taskForm.portfolio_id || ""),
      weight: taskForm.weight || TASK_WEIGHT_DEFAULT,
      task_start_date: taskForm.task_start_date || (!selectedTask ? toLocalISODate() : ""),
      task_end_date: taskForm.task_end_date || "",
    })

    setRepeat({
      repeat: taskForm.repeat ?? DEFAULT_REPEAT_FIELDS.repeat,
      repeat_weekday: taskForm.repeat_weekday ?? DEFAULT_REPEAT_FIELDS.repeat_weekday,
      repeat_month_mode: taskForm.repeat_month_mode ?? DEFAULT_REPEAT_FIELDS.repeat_month_mode,
      repeat_month_day: taskForm.repeat_month_day ?? DEFAULT_REPEAT_FIELDS.repeat_month_day,
      repeat_year_month: taskForm.repeat_year_month ?? DEFAULT_REPEAT_FIELDS.repeat_year_month,
      repeat_end_date: taskForm.repeat_end_date ?? DEFAULT_REPEAT_FIELDS.repeat_end_date,
    })

    setSelectedUserIds(
      taskForm.assigned_users && taskForm.assigned_users.length > 0
        ? taskForm.assigned_users
        : taskForm.assigned_to
          ? [taskForm.assigned_to]
          : []
    )
  }, [isOpen, reset, selectedTask, taskForm, lockedProjectId, lockedPlanId, lockedPortfolioId])

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
  const portfolioId = watch("portfolio_id")
  const weightValue = watch("weight")
  const titleValue = watch("title")
  const statusValue = watch("status")
  const startDateValue = watch("task_start_date")
  const dueDateValue = watch("due_date")

  // New tasks only: the deadline may be at most five working days after the
  // start. Holidays extend the window, so they are loaded to match the server;
  // if they fail to load, the window is just weekends and the API has the final say.
  const isCreating = !selectedTask
  // Company-wide non-working days, so a new task's due date skips them.
  const { data: holidays = NO_HOLIDAYS } = useQuery({
    queryKey: QUERY_KEYS.leaveHolidays(),
    queryFn: async (): Promise<ReadonlySet<string>> => {
      const payload = await apiJson<{
        data?: Array<{ holiday_date: string; location?: string; is_business_day?: boolean }>
      }>("/api/hr/leave/holidays", { cache: "no-store" })
      return new Set(
        (payload.data ?? [])
          .filter((row) => !row.is_business_day && (!row.location || ["all", "global"].includes(row.location)))
          .map((row) => row.holiday_date.slice(0, 10))
      )
    },
    enabled: isOpen && isCreating,
    staleTime: 10 * 60 * 1000,
  })

  const effectiveStartDate = startDateValue || toLocalISODate()
  // Repeat has no default on a new task: the dates stay hidden until it is chosen.
  const repeatUnchosen = isCreating && repeat.repeat === ""
  const isRepeating = isCreating && repeat.repeat !== "" && repeat.repeat !== "none"
  const maxDueDate = isCreating ? latestTaskDeadline(effectiveStartDate, holidays) : undefined
  const deadlineError =
    isCreating && !isRepeating && dueDateValue
      ? taskDeadlineWindowError({ startIso: effectiveStartDate, dueIso: dueDateValue }, holidays)
      : null
  const isMissingDueDate = isCreating && !isRepeating && !dueDateValue

  // A recurring task has no single deadline: each repeat takes its own from
  // the schedule, so the form shows the next few instead.
  const repeatSchedule = isRepeating ? scheduleFromForm({ ...repeat, task_start_date: effectiveStartDate }) : null
  const repeatPreview = repeatSchedule ? upcomingDueDates(repeatSchedule, effectiveStartDate, 3, holidays) : []
  const repeatError = !isRepeating
    ? null
    : effectiveStartDate < toLocalISODate()
      ? "A recurring task cannot start in the past."
      : repeat.repeat_end_date && repeat.repeat_end_date < effectiveStartDate
        ? "The end date must be on or after the start date."
        : repeatPreview.length === 0
          ? "This schedule has no due dates between its start and end dates."
          : null
  const setRepeatField = <K extends keyof RepeatFormFields>(key: K, value: Required<RepeatFormFields>[K]) =>
    setRepeat((current) => ({ ...current, [key]: value }))

  // Corporate KPIs a task may be tagged to: only the ones the target
  // department is CORE or SUPPORT on, per the RACI grid — not all 61.
  const kpiDepartment =
    departmentValue ||
    scopedAssignableEmployees.find((e) => e.id === assignedTo)?.department ||
    scopedAssignableDepartments[0] ||
    ""
  const { data: kpiOptions = NO_KPIS } = useQuery({
    queryKey: QUERY_KEYS.departmentKpis(kpiDepartment),
    queryFn: async () =>
      (
        await apiJson<{ data?: KpiOption[] }>(
          `/api/corporate-scorecard/kpis?department=${encodeURIComponent(kpiDepartment)}`
        )
      ).data ?? [],
    enabled: Boolean(kpiDepartment),
  })

  const selectedKpi = useMemo(() => kpiOptions.find((k) => k.id === kpiId), [kpiOptions, kpiId])

  const sortedKpis = useMemo(() => {
    return [...kpiOptions].sort((a, b) => {
      if (a.role === "core" && b.role !== "core") return -1
      if (a.role !== "core" && b.role === "core") return 1
      return a.measure.localeCompare(b.measure)
    })
  }, [kpiOptions])

  // Projects are optional on a task, so a failed load must never block saving.
  const { data: fetchedProjects } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjectRecords,
    enabled: isOpen && !lockedProjectId && !lockedPortfolioId,
  })
  // Props, then every project the caller can see, then the selected task's own
  // project — so a linked project always displays, even before the list loads.
  const projectOptions = useMemo(() => {
    const map = new Map<string, ProjectOption>()
    for (const p of initialProjects) map.set(p.id, p)
    for (const p of fetchedProjects ?? []) map.set(p.id, { id: p.id, project_name: p.project_name, status: p.status })
    if (selectedTask?.project_id) {
      const existing = map.get(selectedTask.project_id)
      map.set(selectedTask.project_id, {
        id: selectedTask.project_id,
        project_name: selectedTask.project_name || existing?.project_name || "Linked Project",
        status: existing?.status,
      })
    }
    const all = Array.from(map.values())
    // Exclude completed and cancelled projects from new task assignments.
    // If editing an existing task, preserve its currently-linked project.
    if (!selectedTask) {
      return all.filter((p) => p.status !== "completed" && p.status !== "cancelled")
    }
    return all.filter((p) => p.id === selectedTask.project_id || (p.status !== "completed" && p.status !== "cancelled"))
  }, [initialProjects, fetchedProjects, selectedTask])

  // Portfolio-wide work (e.g. a group of sites in development) that no single
  // project owns. Optional like projects, so a failed load never blocks saving.
  const { data: portfoliosPayload } = usePortfolios({ enabled: isOpen && !lockedProjectId && !lockedPortfolioId })
  const portfolioOptions = useMemo(() => {
    const options = (portfoliosPayload?.data ?? []).map((p) => ({ id: p.id, label: portfolioLabel(p) }))
    if (selectedTask?.portfolio_id && !options.some((o) => o.id === selectedTask.portfolio_id)) {
      options.push({ id: selectedTask.portfolio_id, label: selectedTask.portfolio_name || "Linked Portfolio" })
    }
    return options
  }, [portfoliosPayload, selectedTask?.portfolio_id, selectedTask?.portfolio_name])

  const employeeSelectOptions = useMemo(() => {
    return scopedAssignableEmployees.map((member) => ({
      value: member.id,
      label: `${formatFullName(member.first_name, member.last_name)} (${member.department})`,
    }))
  }, [scopedAssignableEmployees])

  function buildTaskFormState(): TaskFormState {
    const values = getValues()
    const targetUsers = isMultiAssign ? selectedUserIds : values.assigned_to ? [values.assigned_to] : []

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
      project_id: lockedPortfolioId
        ? ""
        : lockedProjectId || (values.project_id === "__none__" ? "" : (values.project_id ?? "")),
      plan_id: lockedPlanId || (values.plan_id ?? ""),
      // A task is project work or portfolio work, never both.
      portfolio_id: lockedPortfolioId || (lockedProjectId || values.project_id ? "" : (values.portfolio_id ?? "")),
      weight: values.weight ?? TASK_WEIGHT_DEFAULT,
      goal_id: values.goal_id || "",
      kpi_id: values.kpi_id === "__none__" ? "" : (values.kpi_id ?? ""),
      task_start_date: values.task_start_date ?? "",
      task_end_date: values.task_end_date ?? "",
      ...repeat,
      repeat: isRepeating ? repeat.repeat : "none",
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
                  label: "Weight",
                  value:
                    "How much this task matters relative to the assignee's other work. A weight-4 task counts twice as much as a weight-2 one. Weights do not need to add up to anything.",
                },
                {
                  label: "Project or Portfolio",
                  value:
                    "A project task is rated by that project's manager and counts toward the project's progress. A portfolio task is work across a whole portfolio, such as a group of sites in development.",
                },
                {
                  label: "Recurring Tasks",
                  value:
                    "Set Repeat to create the task on a schedule. Each repeat is an ordinary task, created ahead of its due date, and the whole series counts as one item in the assignee's KPI. A weekend or public holiday moves to the working day before, within the same month.",
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
          <div className="text-warning border-warning/30 bg-warning/10 rounded-md border px-3 py-2 text-xs">
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

        <fieldset disabled={lockLevel === "full"} className="w-full min-w-0 space-y-6 py-2 text-sm">
          {/* Status is not set here. It starts at "pending" for a new task and,
              for an existing one, is owned entirely by TaskStatusControl — the
              dropdown that enforces the mandatory rating on approval. This form
              used to offer "Completed" directly with no rating collected,
              which bypassed that rule completely. */}

          <FormSection title="What">
            <div>
              <Label htmlFor="title" className="text-xs font-semibold">
                Task Title <span className="text-destructive">*</span>
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
          </FormSection>

          <FormSection title="Who and how it counts">
            <div>
              <Label className="text-xs font-semibold">
                Assign to <span className="text-destructive">*</span>
              </Label>

              {!isMultiAssign ? (
                <div className="mt-1">
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
                <div className="mt-1 space-y-1">
                  <SearchableMultiSelect
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
                  {selectedUserIds.length > 1 && (
                    <p className="text-muted-foreground text-xs">
                      {selectedUserIds.length} people selected. Each gets their own copy of the task.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div className="min-w-0">
                <Label htmlFor="kpi_id" className="text-xs font-semibold">
                  Corporate KPI <span className="text-destructive">*</span>
                </Label>
                <Select value={kpiId || ""} onValueChange={(val) => setValue("kpi_id", val)}>
                  <SelectTrigger id="kpi_id" className="mt-1 w-full max-w-full min-w-0 overflow-hidden">
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
                {selectedKpi?.strategic_objective && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Goal: <span className="text-foreground">{selectedKpi.strategic_objective}</span>
                    {selectedKpi.strategic_priority && (
                      <>
                        {" "}
                        · Pillar: <span className="text-foreground">{selectedKpi.strategic_priority}</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="weight" className="text-xs font-semibold">
                  Weight <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={String(weightValue ?? TASK_WEIGHT_DEFAULT)}
                  onValueChange={(val) => setValue("weight", Number(val))}
                  disabled={lockLevel !== "none"}
                >
                  <SelectTrigger id="weight" className="mt-1">
                    <SelectValue placeholder="Select a weight" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: TASK_WEIGHT_MAX - TASK_WEIGHT_MIN + 1 }, (_, i) => TASK_WEIGHT_MIN + i).map(
                      (value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                          {value === TASK_WEIGHT_MIN ? " · lowest" : value === TASK_WEIGHT_MAX ? " · highest" : ""}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <TaskWorkLinkField
              projectId={projectId || ""}
              portfolioId={portfolioId || ""}
              projects={projectOptions}
              portfolios={portfolioOptions}
              onChange={(link) => {
                setValue("project_id", link.project_id)
                setValue("portfolio_id", link.portfolio_id)
              }}
              lockedLabel={
                lockedPortfolioId
                  ? `Portfolio: ${lockedPortfolioName || "This portfolio"}`
                  : lockedProjectId
                    ? `Project: ${lockedProjectName || "This project"}${lockedPlanName ? ` · ${lockedPlanName}` : ""}`
                    : null
              }
            />
          </FormSection>

          <FormSection title="When">
            {/* New tasks only; a repeat is managed from its series */}
            {isCreating && <TaskRepeatFields repeat={repeat} onChange={setRepeat} />}

            {!repeatUnchosen && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="task_start_date" className="text-xs font-semibold">
                    {isRepeating ? "Starts" : "Start Date"}
                  </Label>
                  <Input
                    id="task_start_date"
                    type="date"
                    {...register("task_start_date")}
                    disabled={lockLevel !== "none"}
                    className="mt-1 text-xs"
                  />
                </div>

                {isRepeating ? (
                  <div>
                    <Label htmlFor="repeat_end_date" className="text-xs font-semibold">
                      Ends
                    </Label>
                    <Select
                      value={repeat.repeat_end_date ? "on_date" : "never"}
                      onValueChange={(val) =>
                        setRepeatField(
                          "repeat_end_date",
                          val === "never" ? "" : repeat.repeat_end_date || effectiveStartDate
                        )
                      }
                    >
                      <SelectTrigger className="mt-1 text-xs" aria-label="When the series ends">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="on_date">On a date</SelectItem>
                      </SelectContent>
                    </Select>
                    {repeat.repeat_end_date && (
                      <Input
                        id="repeat_end_date"
                        type="date"
                        min={effectiveStartDate}
                        value={repeat.repeat_end_date}
                        onChange={(e) => setRepeatField("repeat_end_date", e.target.value)}
                        className="mt-2 text-xs"
                      />
                    )}
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="due_date" className="text-xs font-semibold">
                      Due Date {isCreating && <span className="text-destructive">*</span>}
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
                          deadlineError ? "text-destructive mt-1 text-xs" : "text-muted-foreground mt-1 text-xs"
                        }
                      >
                        {deadlineError ??
                          `Latest ${formatWATDate(maxDueDate!)} (${TASK_MAX_WORKING_DAYS} working days).`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {repeatUnchosen && (
              <p className="text-muted-foreground text-xs">
                Choose Repeat to set the dates: &quot;Does not repeat&quot; for a one-off task, or how often it recurs.
              </p>
            )}

            {repeatSchedule && (
              <p className={repeatError ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                {repeatError ??
                  `${describeSchedule(repeatSchedule)}. Next due: ${repeatPreview.map((date) => formatWATDate(date)).join(", ")}${repeatPreview.length === 3 ? ", …" : ""}`}
              </p>
            )}
          </FormSection>
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
              repeatUnchosen ||
              isMissingDueDate ||
              Boolean(repeatError) ||
              (isMultiAssign ? selectedUserIds.length === 0 : !assignedTo)
            }
          >
            {isSaving
              ? "Saving..."
              : selectedTask
                ? "Update Task"
                : isRepeating
                  ? "Create Recurring Task"
                  : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
