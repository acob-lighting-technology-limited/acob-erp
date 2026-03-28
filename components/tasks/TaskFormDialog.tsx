"use client"

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
import { useEffect, useState } from "react"
import type { Task, employee, Project } from "@/app/admin/tasks/management/admin-tasks-content"

interface KpiOption {
  id: string
  title: string
}

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
  activeEmployees: employee[]
  departments: string[]
  projects: Project[]
}

export function TaskFormDialog({
  isOpen,
  onOpenChange,
  selectedTask,
  taskForm,
  setTaskForm,
  onSave,
  isSaving,
  activeEmployees,
  departments,
  projects,
}: TaskFormDialogProps) {
  const [kpiOptions, setKpiOptions] = useState<KpiOption[]>([])

  // Load approved KPIs for the selected assignee
  useEffect(() => {
    if (taskForm.assignment_type !== "individual" || !taskForm.assigned_to) {
      setKpiOptions([])
      return
    }
    fetch(`/api/hr/performance/goals?user_id=${taskForm.assigned_to}`)
      .then((r) => r.json())
      .then((json) => {
        const approved = (json.data ?? json.goals ?? []).filter(
          (g: { approval_status: string }) => g.approval_status === "approved"
        )
        setKpiOptions(approved.map((g: { id: string; title: string }) => ({ id: g.id, title: g.title })))
      })
      .catch(() => setKpiOptions([]))
  }, [taskForm.assigned_to, taskForm.assignment_type])

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
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="e.g., Complete monthly report"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              placeholder="Provide detailed task information..."
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={taskForm.priority}
                onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}
              >
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
              <Select value={taskForm.status} onValueChange={(value) => setTaskForm({ ...taskForm, status: value })}>
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
              value={taskForm.assignment_type}
              onValueChange={(value: "individual" | "multiple" | "department") => {
                setTaskForm({
                  ...taskForm,
                  assignment_type: value,
                  assigned_to: value === "individual" ? taskForm.assigned_to : "",
                  assigned_users: value === "multiple" ? taskForm.assigned_users : [],
                  department: value === "department" ? taskForm.department : "",
                })
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

          {taskForm.assignment_type === "individual" && (
            <div>
              <Label htmlFor="assigned_to">Assign To *</Label>
              <SearchableSelect
                value={taskForm.assigned_to}
                onValueChange={(value) => {
                  const selectedEmployee = activeEmployees.find((s) => s.id === value)
                  setTaskForm({
                    ...taskForm,
                    assigned_to: value,
                    department: selectedEmployee?.department || "",
                  })
                }}
                placeholder="Select employee member"
                searchPlaceholder="Search employee..."
                icon={<User className="h-4 w-4" />}
                options={activeEmployees.map((member) => ({
                  value: member.id,
                  label: `${member.first_name} ${member.last_name} - ${member.department}`,
                }))}
              />
            </div>
          )}

          {taskForm.assignment_type === "multiple" && (
            <div>
              <Label>Assign To Multiple People *</Label>
              <Card className="mt-2 border-2">
                <ScrollArea className="h-[200px]">
                  <CardContent className="space-y-2 p-4">
                    {activeEmployees.length === 0 ? (
                      <EmptyState
                        title="No employee members found"
                        description="Activate employee records to assign this task to multiple users."
                        className="p-4"
                      />
                    ) : (
                      activeEmployees.map((member) => (
                        <div key={member.id} className="hover:bg-muted flex items-center space-x-2 rounded-md p-2">
                          <Checkbox
                            id={`member-${member.id}`}
                            checked={taskForm.assigned_users.includes(member.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTaskForm({
                                  ...taskForm,
                                  assigned_users: [...taskForm.assigned_users, member.id],
                                })
                              } else {
                                setTaskForm({
                                  ...taskForm,
                                  assigned_users: taskForm.assigned_users.filter((id) => id !== member.id),
                                })
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
                {taskForm.assigned_users.length} employee member{taskForm.assigned_users.length !== 1 ? "s" : ""}{" "}
                selected
              </p>
            </div>
          )}

          {taskForm.assignment_type === "department" && (
            <div>
              <Label htmlFor="department">Department *</Label>
              <Select
                value={taskForm.department}
                onValueChange={(value) => {
                  setTaskForm({
                    ...taskForm,
                    department: value,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No departments found
                    </SelectItem>
                  ) : (
                    departments.map((dept) => (
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
            <Select
              value={taskForm.project_id}
              onValueChange={(value) => setTaskForm({ ...taskForm, project_id: value })}
            >
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

          {/* KPI Link — only for individual tasks with approved KPIs */}
          {taskForm.assignment_type === "individual" && kpiOptions.length > 0 && (
            <div>
              <Label htmlFor="goal_id">Link to KPI (Optional)</Label>
              <Select value={taskForm.goal_id} onValueChange={(value) => setTaskForm({ ...taskForm, goal_id: value })}>
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
                Completing this task will count toward the selected KPI achievement score.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={taskForm.due_date}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
            />
          </div>

          {taskForm.project_id && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task_start_date">Task Start Date</Label>
                <Input
                  id="task_start_date"
                  type="date"
                  value={taskForm.task_start_date}
                  onChange={(e) => setTaskForm({ ...taskForm, task_start_date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="task_end_date">Task End Date</Label>
                <Input
                  id="task_end_date"
                  type="date"
                  min={taskForm.task_start_date || undefined}
                  value={taskForm.task_end_date}
                  onChange={(e) => setTaskForm({ ...taskForm, task_end_date: e.target.value })}
                />
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
              !taskForm.title ||
              (taskForm.assignment_type === "individual" && !taskForm.assigned_to) ||
              (taskForm.assignment_type === "multiple" && taskForm.assigned_users.length === 0) ||
              (taskForm.assignment_type === "department" && !taskForm.department)
            }
          >
            {selectedTask ? "Update Task" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
