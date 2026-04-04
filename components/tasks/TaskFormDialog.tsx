"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/patterns"
import { ItemInfoButton } from "@/components/ui/item-info-button"
import { User, Users, Building2 } from "lucide-react"
import type { Task } from "@/types/task"
import type { employee, Project } from "@/app/admin/tasks/management/admin-tasks-content"

interface KpiOption {
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
  assignment_type: z.enum(["individual", "multiple", "department"]),
  assigned_users: z.array(z.string()),
  project_id: z.string(),
  goal_id: z.string(),
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
  assignment_type: "individual" | "multiple" | "department"
  assigned_users: string[]
  project_id: string
  goal_id: string // PMS: optional KPI link
  task_start_date: string
  task_end_date: string
}

interface TaskFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedTask: Task | null
  taskForm: TaskFormState
  setTaskForm: (form: TaskFormState) => void
  onSave: () => void
  isSaving: boolean
  scopedAssignableEmployees: employee[]
  scopedAssignableDepartments: string[]
  projects: Project[]
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
  projects,
  assignmentAuthorityLabel,
}: TaskFormDialogProps) {
  const [kpiOptions, setKpiOptions] = useState<KpiOption[]>([])

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
      assigned_users: taskForm.assigned_users,
      project_id: taskForm.project_id,
      goal_id: taskForm.goal_id,
      task_start_date: taskForm.task_start_date,
      task_end_date: taskForm.task_end_date,
    },
  })

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form

  // Sync form state back to parent whenever values change
  useEffect(() => {
    const subscription = watch((values) => {
      setTaskForm({
        title: values.title ?? "",
        description: values.description ?? "",
        priority: values.priority ?? "",
        status: values.status ?? "",
        assigned_to: values.assigned_to ?? "",
        department: values.department ?? "",
        due_date: values.due_date ?? "",
        assignment_type: (values.assignment_type ?? "individual") as "individual" | "multiple" | "department",
        assigned_users: (values.assigned_users ?? []).filter((value): value is string => Boolean(value)),
        project_id: values.project_id ?? "",
        goal_id: values.goal_id ?? "",
        task_start_date: values.task_start_date ?? "",
        task_end_date: values.task_end_date ?? "",
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, setTaskForm])

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        status: taskForm.status,
        assigned_to: taskForm.assigned_to,
        department: taskForm.department,
        due_date: taskForm.due_date,
        assignment_type: taskForm.assignment_type,
        assigned_users: taskForm.assigned_users,
        project_id: taskForm.project_id,
        goal_id: taskForm.goal_id,
        task_start_date: taskForm.task_start_date,
        task_end_date: taskForm.task_end_date,
      })
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const assignmentType = watch("assignment_type")
  const assignedTo = watch("assigned_to")
  const assignedUsers = watch("assigned_users")
  const departmentValue = watch("department")
  const titleValue = watch("title")
  const priorityValue = watch("priority")
  const statusValue = watch("status")
  const projectId = watch("project_id")
  const goalId = watch("goal_id")
  const taskStartDate = watch("task_start_date")

  // Load approved KPIs for the selected assignee or current department context
  useEffect(() => {
    const targetUserId =
      assignmentType === "individual" ? assignedTo : assignmentType === "multiple" ? assignedUsers[0] || "" : ""
    const targetDepartment = assignmentType === "department" ? departmentValue : ""

    if (!targetUserId && !targetDepartment) {
      setKpiOptions([])
      return
    }

    const query = targetUserId ? `?user_id=${targetUserId}` : ""
    fetch(`/api/hr/performance/goals${query}`)
      .then((r) => r.json())
      .then((json) => {
        const approved = (json.data ?? json.goals ?? []).filter(
          (g: { approval_status: string }) => g.approval_status === "approved"
        )
        const scopedGoals = targetDepartment
          ? approved.filter((goal: { department?: string | null; title: string }) =>
              goal.department
                ? String(goal.department).toLowerCase() === targetDepartment.toLowerCase()
                : goal.title.toLowerCase().includes(targetDepartment.toLowerCase())
            )
          : approved
        setKpiOptions(scopedGoals.map((g: { id: string; title: string }) => ({ id: g.id, title: g.title })))
      })
      .catch(() => setKpiOptions([]))
  }, [assignedTo, assignedUsers, assignmentType, departmentValue])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{selectedTask ? "Edit Task" : "Create New Task"}</DialogTitle>
            <ItemInfoButton
              title="Task workflow guide"
              summary="Tasks are work items that can be assigned to one person, multiple people, or a department."
              details={[
                {
                  label: "What happens after creation",
                  value:
                    "The selected assignee, team, or department will see the task in their workflow and should update status as the work moves forward.",
                },
                {
                  label: "When to link a project",
                  value:
                    "Choose a project when the task belongs to a specific project so it stays visible both in project context and in the assignee's task list.",
                },
                {
                  label: "How to make the task clear",
                  value:
                    "Write the expected outcome, add timing if it matters, and assign it to the person or team that should actually complete it.",
                },
              ]}
            />
          </div>
          <DialogDescription>
            {selectedTask ? "Update the task information below" : "Enter the details for the new task"}
          </DialogDescription>
          {assignmentAuthorityLabel ? (
            <p className="text-muted-foreground text-xs">{assignmentAuthorityLabel}</p>
          ) : null}
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input id="title" {...register("title")} placeholder="e.g., Complete monthly report" />
            {errors.title && <p className="text-destructive mt-1 text-xs">{errors.title.message}</p>}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Provide detailed task information..."
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

          {/* Assignment Type */}
          <div>
            <Label htmlFor="assignment_type">Assignment Type *</Label>
            <Select
              value={assignmentType}
              onValueChange={(value: "individual" | "multiple" | "department") => {
                setValue("assignment_type", value)
                setValue("assigned_to", value === "individual" ? assignedTo : "")
                setValue("assigned_users", value === "multiple" ? assignedUsers : [])
                setValue("department", value === "department" ? departmentValue : "")
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
                <SelectItem value="multiple">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Multiple People (Group Task)
                  </div>
                </SelectItem>
                <SelectItem value="department">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Department Assignment
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignmentType === "individual" && (
            <div>
              <Label htmlFor="assigned_to">Assign To *</Label>
              <SearchableSelect
                value={assignedTo}
                onValueChange={(value) => {
                  const selectedEmployee = scopedAssignableEmployees.find((s) => s.id === value)
                  setValue("assigned_to", value)
                  setValue("department", selectedEmployee?.department || "")
                }}
                placeholder="Select employee member"
                searchPlaceholder="Search employee..."
                icon={<User className="h-4 w-4" />}
                options={scopedAssignableEmployees.map((member) => ({
                  value: member.id,
                  label: `${member.first_name} ${member.last_name} - ${member.department}`,
                }))}
              />
            </div>
          )}

          {assignmentType === "multiple" && (
            <div>
              <Label>Assign To Multiple People *</Label>
              <Card className="mt-2 border-2">
                <ScrollArea className="h-[200px]">
                  <CardContent className="space-y-2 p-4">
                    {scopedAssignableEmployees.length === 0 ? (
                      <EmptyState
                        title="No employee members found"
                        description="Activate employee records to assign this task to multiple users."
                        className="p-4"
                      />
                    ) : (
                      scopedAssignableEmployees.map((member) => (
                        <div key={member.id} className="hover:bg-muted flex items-center space-x-2 rounded-md p-2">
                          <Checkbox
                            id={`member-${member.id}`}
                            checked={assignedUsers.includes(member.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setValue("assigned_users", [...assignedUsers, member.id])
                              } else {
                                setValue(
                                  "assigned_users",
                                  assignedUsers.filter((id) => id !== member.id)
                                )
                              }
                            }}
                          />
                          <label
                            htmlFor={`member-${member.id}`}
                            className="flex-1 cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {member.first_name} {member.last_name} - {member.department}
                          </label>
                        </div>
                      ))
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>
              <p className="text-muted-foreground mt-1 text-xs">
                {assignedUsers.length} employee member{assignedUsers.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          )}

          {assignmentType === "department" && (
            <div>
              <Label htmlFor="department">Department *</Label>
              <Select
                value={departmentValue}
                onValueChange={(value) => {
                  setValue("department", value)
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
                    scopedAssignableDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                All employee in this department will see this task. Only department leads, admins, and super admins can
                change the status.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="project_id">Project (Optional)</Label>
            <Select value={projectId} onValueChange={(value) => setValue("project_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(assignmentType === "individual" || assignmentType === "multiple" || assignmentType === "department") &&
            kpiOptions.length > 0 && (
              <div>
                <Label htmlFor="goal_id">Link to KPI (Optional)</Label>
                <Select value={goalId} onValueChange={(value) => setValue("goal_id", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a KPI this task contributes to" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {kpiOptions.map((kpi) => (
                      <SelectItem key={kpi.id} value={kpi.id}>
                        {kpi.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground mt-1 text-xs">
                  Leave this blank to let the system auto-link the task to the best approved KPI bucket for the
                  assignee.
                </p>
              </div>
            )}

          <div>
            <Label htmlFor="due_date">Due Date</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
          </div>

          {projectId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task_start_date">Task Start Date</Label>
                <Input id="task_start_date" type="date" {...register("task_start_date")} />
              </div>

              <div>
                <Label htmlFor="task_end_date">Task End Date</Label>
                <Input id="task_end_date" type="date" min={taskStartDate || undefined} {...register("task_end_date")} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            loading={isSaving}
            disabled={
              !titleValue ||
              (assignmentType === "individual" && !assignedTo) ||
              (assignmentType === "multiple" && assignedUsers.length === 0) ||
              (assignmentType === "department" && !departmentValue)
            }
          >
            {selectedTask ? "Update Task" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
