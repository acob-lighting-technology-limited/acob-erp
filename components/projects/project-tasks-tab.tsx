"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Checkbox } from "@/components/ui/checkbox"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { ItemInfoButton } from "@/components/ui/item-info-button"
import { ClipboardList, Plus, User } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/ui/patterns"
import { toast } from "sonner"

interface TaskUser {
  first_name: string
  last_name: string
}

interface ProjectTask {
  id: string
  title: string
  work_item_number?: string | null
  description?: string
  priority: string
  status: string
  assignment_type?: "individual" | "multiple" | "department"
  department?: string | null
  progress?: number | null
  due_date?: string
  task_start_date?: string
  task_end_date?: string
  assigned_to_user?: TaskUser | null
}

interface ProjectTaskMember {
  user_id: string
  role: string
  user: {
    first_name: string
    last_name: string
    company_email: string
    department: string
  }
}

interface ProjectTasksTabProps {
  tasks: ProjectTask[]
  members?: ProjectTaskMember[]
  projectId?: string
  canManageTasks?: boolean
  taskLinkBase?: "/tasks" | "/admin/tasks"
  getStatusColor: (status: string) => string
  getPriorityColor: (priority: string) => string
  formatDate: (dateString: string) => string
  onTaskCreated?: () => void | Promise<void>
}

const INITIAL_FORM = {
  title: "",
  description: "",
  assignment_type: "individual" as "individual" | "multiple" | "department",
  assigned_to: "",
  assigned_users: [] as string[],
  department: "",
  priority: "medium",
  due_date: "",
  task_start_date: "",
  task_end_date: "",
}

function buildProjectTaskInfo(task: ProjectTask) {
  return {
    title: task.work_item_number ? `${task.work_item_number} project task guide` : "Project task guide",
    summary: "This project task is tied to a specific project and will also appear in the assigned person's task list.",
    details: [
      {
        label: "Why this is here",
        value:
          "Project tasks track work that belongs to this project while still staying visible in the assignee's personal task workflow.",
      },
      {
        label: "Current expectation",
        value: task.assigned_to_user
          ? `${task.assigned_to_user.first_name} ${task.assigned_to_user.last_name} is expected to handle this work item.`
          : "This task should be assigned to a project member so ownership is clear.",
      },
      {
        label: "What good completion looks like",
        value:
          "Finish the requested project work, update the task status as progress changes, and leave enough context for the project team to understand the outcome.",
      },
    ],
  }
}

export function ProjectTasksTab({
  tasks,
  members = [],
  projectId,
  canManageTasks = false,
  taskLinkBase = "/tasks",
  getStatusColor,
  getPriorityColor,
  formatDate,
  onTaskCreated,
}: ProjectTasksTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.user_id,
        label: `${member.user.first_name} ${member.user.last_name} - ${member.user.department}`,
        icon: <User className="h-3 w-3" />,
      })),
    [members]
  )
  const memberDepartments = useMemo(
    () => Array.from(new Set(members.map((member) => member.user.department).filter(Boolean))),
    [members]
  )

  const resetForm = () => {
    setForm(INITIAL_FORM)
  }

  const handleCreateTask = async () => {
    if (!projectId || !form.title.trim() || !form.assigned_to) {
      toast.error("Task title and assignee are required")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create project task")
      }

      toast.success("Project task created")
      setIsCreateOpen(false)
      resetForm()
      await onTaskCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project task")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Project Tasks</CardTitle>
            <CardDescription>Tasks associated with this project</CardDescription>
          </div>
          {canManageTasks && (
            <Button onClick={() => setIsCreateOpen(true)} disabled={!projectId || members.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Task
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState
              title="No tasks assigned to this project yet"
              description={
                canManageTasks
                  ? 'Use "Assign Task" to create the first project task.'
                  : "Task assignments linked to this project will appear here."
              }
              icon={ClipboardList}
              className="border-0"
            />
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Link key={task.id} href={taskLinkBase}>
                  <div className="hover:bg-accent cursor-pointer rounded-lg border p-3 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="font-medium">{task.title}</p>
                          {task.work_item_number && (
                            <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                              {task.work_item_number}
                            </Badge>
                          )}
                          <ItemInfoButton {...buildProjectTaskInfo(task)} />
                          <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                        </div>
                        {task.description && (
                          <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {task.assignment_type === "department"
                              ? `Department: ${task.department || "Unassigned"}`
                              : "Assigned to: "}
                            {task.assignment_type !== "department" ? (
                              <span className="text-foreground font-medium">
                                {task.assignment_type === "multiple"
                                  ? "Multiple team members"
                                  : task.assigned_to_user
                                    ? `${task.assigned_to_user.first_name} ${task.assigned_to_user.last_name}`
                                    : "Unassigned"}
                              </span>
                            ) : null}
                          </span>
                          {task.task_start_date && task.task_end_date && (
                            <span className="text-muted-foreground">
                              {formatDate(task.task_start_date)} - {formatDate(task.task_end_date)}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-muted-foreground">
                              Due: <span className="text-foreground font-medium">{formatDate(task.due_date)}</span>
                            </span>
                          )}
                          {typeof task.progress === "number" && (
                            <span className="text-muted-foreground">
                              Progress: <span className="text-foreground font-medium">{task.progress}%</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ResponsiveModal
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) resetForm()
        }}
        title="Assign Project Task"
        description="Create a project-linked task and assign it to one member, multiple members, or a department."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="project-task-title">Task Title</Label>
            <Input
              id="project-task-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Install controller, submit BOQ, prepare report..."
            />
          </div>

          <div>
            <Label htmlFor="project-task-description">Description</Label>
            <Textarea
              id="project-task-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Add the exact outcome, handover note, or execution detail."
              className="min-h-[120px]"
            />
          </div>

          <div>
            <Label htmlFor="project-task-assignment-type">Assignment Type</Label>
            <select
              id="project-task-assignment-type"
              value={form.assignment_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  assignment_type: event.target.value as "individual" | "multiple" | "department",
                  assigned_to: "",
                  assigned_users: [],
                  department: "",
                }))
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="individual">Individual</option>
              <option value="multiple">Multiple People</option>
              <option value="department">Department</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {form.assignment_type === "individual" ? (
              <div>
                <Label>Assign To</Label>
                <SearchableSelect
                  value={form.assigned_to}
                  onValueChange={(value) => setForm((current) => ({ ...current, assigned_to: value }))}
                  placeholder="Choose project member"
                  searchPlaceholder="Search project members..."
                  icon={<User className="h-4 w-4" />}
                  options={memberOptions}
                />
              </div>
            ) : null}

            {form.assignment_type === "department" ? (
              <div>
                <Label htmlFor="project-task-department">Department</Label>
                <select
                  id="project-task-department"
                  value={form.department}
                  onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Select department</option>
                  {memberDepartments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <Label htmlFor="project-task-priority">Priority</Label>
              <select
                id="project-task-priority"
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {form.assignment_type === "multiple" ? (
            <div className="space-y-2">
              <Label>Assign To Multiple People</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {members.map((member) => (
                  <label key={member.user_id} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={form.assigned_users.includes(member.user_id)}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          assigned_users: checked
                            ? [...current.assigned_users, member.user_id]
                            : current.assigned_users.filter((userId) => userId !== member.user_id),
                        }))
                      }
                    />
                    <span>
                      {member.user.first_name} {member.user.last_name} - {member.user.department}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="project-task-due-date">Due Date</Label>
              <Input
                id="project-task-due-date"
                type="date"
                value={form.due_date}
                onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="project-task-start-date">Task Start Date</Label>
              <Input
                id="project-task-start-date"
                type="date"
                value={form.task_start_date}
                onChange={(event) => setForm((current) => ({ ...current, task_start_date: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="project-task-end-date">Task End Date</Label>
              <Input
                id="project-task-end-date"
                type="date"
                min={form.task_start_date || undefined}
                value={form.task_end_date}
                onChange={(event) => setForm((current) => ({ ...current, task_end_date: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              loading={isSaving}
              disabled={
                !form.title.trim() ||
                (form.assignment_type === "individual" && !form.assigned_to) ||
                (form.assignment_type === "multiple" && form.assigned_users.length === 0) ||
                (form.assignment_type === "department" && !form.department)
              }
            >
              Create Task
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  )
}
