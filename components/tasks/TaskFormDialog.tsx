"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, Target, User } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Task } from "@/types/task"
import type { employee } from "@/app/admin/tasks/management/admin-tasks-content"

interface GoalOption {
  id: string
  title: string
}

const taskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string(),
  priority: z.string(),
  status: z.string(),
  assigned_to: z.string(),
  department: z.string(),
  due_date: z.string(),
  assignment_type: z.enum(["individual", "department"]),
  goal_id: z.string().min(1, "Goal is required"),
  task_start_date: z.string(),
  task_end_date: z.string(),
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
  assignment_type: "individual" | "department"
  assigned_users: string[]
  project_id: string
  goal_id: string
  task_start_date: string
  task_end_date: string
}

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
  assignmentAuthorityLabel?: string
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
  assignmentAuthorityLabel,
}: TaskFormDialogProps) {
  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([])

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
      task_start_date: taskForm.task_start_date,
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
      priority: taskForm.priority,
      status: taskForm.status,
      assigned_to: taskForm.assigned_to,
      department: taskForm.department,
      due_date: taskForm.due_date,
      assignment_type: taskForm.assignment_type,
      goal_id: taskForm.goal_id,
      task_start_date: taskForm.task_start_date,
      task_end_date: taskForm.task_end_date,
    })
  }, [
    isOpen,
    reset,
    selectedTask?.id,
    taskForm.assigned_to,
    taskForm.assignment_type,
    taskForm.department,
    taskForm.description,
    taskForm.due_date,
    taskForm.goal_id,
    taskForm.priority,
    taskForm.status,
    taskForm.task_end_date,
    taskForm.task_start_date,
    taskForm.title,
  ])

  const assignmentType = watch("assignment_type")
  const assignedTo = watch("assigned_to")
  const departmentValue = watch("department")
  const goalId = watch("goal_id")
  const titleValue = watch("title")
  const priorityValue = watch("priority")
  const statusValue = watch("status")

  useEffect(() => {
    const selectedEmployee = scopedAssignableEmployees.find((member) => member.id === assignedTo)
    const targetDepartment =
      assignmentType === "department"
        ? departmentValue
        : assignmentType === "individual"
          ? selectedEmployee?.department || ""
          : ""

    if (!targetDepartment) {
      setGoalOptions([])
      return
    }

    const query = `?department=${encodeURIComponent(targetDepartment)}`

    fetch(`/api/hr/performance/goals${query}`)
      .then((response) => response.json())
      .then((payload) => {
        const approvedGoals = (payload.data ?? []).filter(
          (goal: { approval_status?: string }) => goal.approval_status === "approved"
        )

        setGoalOptions(approvedGoals.map((goal: { id: string; title: string }) => ({ id: goal.id, title: goal.title })))
      })
      .catch(() => setGoalOptions([]))
  }, [assignedTo, assignmentType, departmentValue, scopedAssignableEmployees])

  function buildTaskFormState() {
    const values = getValues()
    return {
      title: values.title ?? "",
      description: values.description ?? "",
      priority: values.priority ?? "medium",
      status: values.status ?? "pending",
      assigned_to: values.assigned_to ?? "",
      department: values.department ?? "",
      due_date: values.due_date ?? "",
      assignment_type: (values.assignment_type ?? "individual") as "individual" | "department",
      assigned_users: [],
      project_id: "",
      goal_id: values.goal_id ?? "",
      task_start_date: values.task_start_date ?? "",
      task_end_date: values.task_end_date ?? "",
    } satisfies TaskFormState
  }

  function handleSaveClick() {
    const nextTaskForm = buildTaskFormState()
    setTaskForm(nextTaskForm)
    onSave(nextTaskForm)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{selectedTask ? "Edit Task" : "Create New Task"}</DialogTitle>
            <ItemInfoButton
              title="Task workflow guide"
              summary="Tasks now belong to approved department goals and can be assigned to one person or a department queue."
              details={[
                {
                  label: "Goal-first workflow",
                  value:
                    "A department lead creates the yearly goal first, then creates tasks under that goal for individual staff or the department queue.",
                },
                {
                  label: "Assignment scope",
                  value:
                    "Group work is no longer created here. Use one assignee for individual execution or assign the task to the department queue.",
                },
                {
                  label: "KPI impact",
                  value:
                    "Weekly task progress feeds KPI only after the linked goal progress is reviewed and approved by the lead.",
                },
              ]}
            />
          </div>
          <DialogDescription>
            {selectedTask
              ? "Update the task details below."
              : "Create a department-aligned task linked to an approved goal."}
          </DialogDescription>
          {assignmentAuthorityLabel ? (
            <p className="text-muted-foreground text-xs">{assignmentAuthorityLabel}</p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="e.g., Close outstanding generator maintenance tickets"
            />
            {errors.title ? <p className="text-destructive mt-1 text-xs">{errors.title.message}</p> : null}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Describe the expected outcome, scope, and reporting expectation."
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priorityValue} onValueChange={(value) => setValue("priority", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusValue} onValueChange={(value) => setValue("status", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="assignment_type">Assignment Type *</Label>
            <Select
              value={assignmentType}
              onValueChange={(value: "individual" | "department") => {
                setValue("assignment_type", value)
                setValue("assigned_to", value === "individual" ? assignedTo : "")
                setValue("department", value === "department" ? departmentValue : "")
                setValue("goal_id", "")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Individual Assignment
                  </div>
                </SelectItem>
                <SelectItem value="department">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Department Queue
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignmentType === "individual" ? (
            <div>
              <Label htmlFor="assigned_to">Assign To *</Label>
              <SearchableSelect
                value={assignedTo}
                onValueChange={(value) => {
                  const selectedEmployee = scopedAssignableEmployees.find((member) => member.id === value)
                  setValue("assigned_to", value)
                  setValue("department", selectedEmployee?.department || "")
                  setValue("goal_id", "")
                }}
                placeholder="Select staff member"
                searchPlaceholder="Search employee..."
                icon={<User className="h-4 w-4" />}
                options={scopedAssignableEmployees.map((member) => ({
                  value: member.id,
                  label: `${member.first_name} ${member.last_name} - ${member.department}`,
                }))}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="department">Department *</Label>
              <Select
                value={departmentValue}
                onValueChange={(value) => {
                  setValue("department", value)
                  setValue("goal_id", "")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {scopedAssignableDepartments.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No departments found
                    </SelectItem>
                  ) : (
                    scopedAssignableDepartments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                Department tasks stay in the queue until a lead moves them forward.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="goal_id">Department Goal *</Label>
            <Select value={goalId} onValueChange={(value) => setValue("goal_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select the approved goal this task contributes to" />
              </SelectTrigger>
              <SelectContent>
                {goalOptions.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    No approved goals available
                  </SelectItem>
                ) : (
                  goalOptions.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="text-muted-foreground mt-2 flex items-start gap-2 text-xs">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Fallback goals are no longer auto-created. Approve the right department goal first, then link the task
                here.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="due_date">Due Date</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveClick}
            loading={isSaving}
            disabled={!titleValue || !goalId || (assignmentType === "individual" ? !assignedTo : !departmentValue)}
          >
            {selectedTask ? "Update Task" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
