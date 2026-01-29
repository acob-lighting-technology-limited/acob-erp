"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import {
  ClipboardList,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  User,
  LayoutGrid,
  List,
  Users,
  Building2,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { dateValidation } from "@/lib/validation"

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

export interface Staff {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
}

export interface UserProfile {
  role: string
  lead_departments?: string[]
}

export interface Project {
  id: string
  project_name: string
}

interface AdminTasksContentProps {
  initialTasks: Task[]
  initialStaff: Staff[]
  initialProjects: Project[]
  initialDepartments: string[]
  userProfile: UserProfile
}

export function AdminTasksContent({
  initialTasks,
  initialStaff,
  initialProjects,
  initialDepartments,
  userProfile,
}: AdminTasksContentProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [staff] = useState<Staff[]>(initialStaff)
  const [departments] = useState<string[]>(initialDepartments)
  const [projects] = useState<Project[]>(initialProjects)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [staffFilter, setStaffFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    assigned_to: "",
    department: "",
    due_date: "",
    assignment_type: "individual" as "individual" | "multiple" | "department",
    assigned_users: [] as string[],
    project_id: "",
    task_start_date: "",
    task_end_date: "",
  })

  const supabase = createClient()

  const loadData = async () => {
    try {
      let tasksQuery = supabase.from("tasks").select("*").order("created_at", { ascending: false })

      if (userProfile?.role === "lead" && userProfile?.lead_departments && userProfile.lead_departments.length > 0) {
        tasksQuery = tasksQuery.in("department", userProfile.lead_departments)
      }

      const { data: tasksData, error: tasksError } = await tasksQuery
      if (tasksError) throw tasksError

      const tasksWithUsers = await Promise.all(
        (tasksData || []).map(async (task: any) => {
          const taskData: any = { ...task }

          if (task.assignment_type === "individual" && task.assigned_to) {
            const { data: userProfileData } = await supabase
              .from("profiles")
              .select("first_name, last_name, department")
              .eq("id", task.assigned_to)
              .single()
            taskData.assigned_to_user = userProfileData
          }

          if (task.assignment_type === "multiple") {
            const { data: assignments } = await supabase
              .from("task_assignments")
              .select("user_id")
              .eq("task_id", task.id)

            if (assignments && assignments.length > 0) {
              const userIds = assignments.map((a: any) => a.user_id)
              const { data: userProfiles } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, department")
                .in("id", userIds)

              const { data: completions } = await supabase
                .from("task_user_completion")
                .select("user_id")
                .eq("task_id", task.id)

              const completedUserIds = new Set(completions?.map((c: any) => c.user_id) || [])

              taskData.assigned_users =
                userProfiles?.map((p: any) => ({
                  ...p,
                  completed: completedUserIds.has(p.id),
                })) || []
            }
          }

          return taskData
        })
      )

      let filteredTasks = tasksWithUsers || []
      if (userProfile?.role === "lead" && userProfile?.lead_departments && userProfile.lead_departments.length > 0) {
        filteredTasks = filteredTasks.filter((task: any) => {
          if (task.department && userProfile.lead_departments?.includes(task.department)) return true
          if (
            task.assigned_to_user?.department &&
            userProfile.lead_departments?.includes(task.assigned_to_user.department)
          )
            return true
          if (
            task.assigned_users?.some((u: any) => u.department && userProfile.lead_departments?.includes(u.department))
          )
            return true
          return false
        })
      }

      setTasks(filteredTasks as Task[])
    } catch (error: any) {
      console.error("Error loading data:", error)
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
        task_start_date: task.task_start_date || "",
        task_end_date: task.task_end_date || "",
      })
    } else {
      setSelectedTask(null)
      setTaskForm({
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
        task_start_date: "",
        task_end_date: "",
      })
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

      if (taskForm.assignment_type === "individual" && !taskForm.assigned_to) {
        toast.error("Please select a staff member for individual assignment")
        setIsSaving(false)
        return
      }
      if (taskForm.assignment_type === "multiple" && taskForm.assigned_users.length === 0) {
        toast.error("Please select at least one staff member for multiple assignment")
        setIsSaving(false)
        return
      }
      if (taskForm.assignment_type === "department" && !taskForm.department) {
        toast.error("Please select a department for department assignment")
        setIsSaving(false)
        return
      }

      if (taskForm.task_start_date && taskForm.task_end_date) {
        const dateError = dateValidation.validateDateRange(
          taskForm.task_start_date,
          taskForm.task_end_date,
          "task date"
        )
        if (dateError) {
          toast.error(dateError)
          setIsSaving(false)
          return
        }
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
        task_start_date: taskForm.task_start_date || null,
        task_end_date: taskForm.task_end_date || null,
      }

      if (selectedTask) {
        const { error: taskError } = await supabase.from("tasks").update(taskData).eq("id", selectedTask.id)
        if (taskError) throw taskError

        if (taskForm.assignment_type === "multiple") {
          await supabase.from("task_assignments").delete().eq("task_id", selectedTask.id)
          if (taskForm.assigned_users.length > 0) {
            const assignments = taskForm.assigned_users.map((userId: string) => ({
              task_id: selectedTask.id,
              user_id: userId,
            }))
            const { error: assignError } = await supabase.from("task_assignments").insert(assignments)
            if (assignError) throw assignError
          }
        }

        await supabase.from("task_updates").insert({
          task_id: selectedTask.id,
          user_id: user.id,
          update_type: "task_updated",
          content: "Task details updated by admin",
        })

        await supabase.rpc("log_audit", {
          p_action: "update",
          p_entity_type: "task",
          p_entity_id: selectedTask.id,
          p_new_values: taskData,
        })

        toast.success("Task updated successfully")
      } else {
        const { data: newTask, error: taskError } = await supabase.from("tasks").insert(taskData).select().single()
        if (taskError) throw taskError

        if (taskForm.assignment_type === "multiple" && taskForm.assigned_users.length > 0) {
          const assignments = taskForm.assigned_users.map((userId: string) => ({
            task_id: newTask.id,
            user_id: userId,
          }))
          const { error: assignError } = await supabase.from("task_assignments").insert(assignments)
          if (assignError) throw assignError
        }

        await supabase.rpc("log_audit", {
          p_action: "create",
          p_entity_type: "task",
          p_entity_id: newTask.id,
          p_new_values: taskData,
        })

        toast.success("Task created successfully")
      }

      setIsTaskDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error saving task:", error)
      toast.error(`Failed to save task: ${error.message || "Unknown error"}`)
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

      await supabase.rpc("log_audit", {
        p_action: "delete",
        p_entity_type: "task",
        p_entity_id: taskToDelete.id,
        p_old_values: taskToDelete,
      })

      toast.success("Task deleted successfully")
      setIsDeleteDialogOpen(false)
      setTaskToDelete(null)
      loadData()
    } catch (error) {
      console.error("Error deleting task:", error)
      toast.error("Failed to delete task")
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter

    let matchesDepartment = true
    if (userProfile?.role === "lead") {
      if (userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        const leadDepartments = userProfile.lead_departments
        matchesDepartment =
          leadDepartments.includes(task.department || "") ||
          (task.assigned_to_user ? leadDepartments.includes(task.assigned_to_user.department || "") : false) ||
          task.assigned_users?.some((u: any) => u.department && leadDepartments.includes(u.department)) ||
          false
      }
    } else {
      matchesDepartment =
        departmentFilter === "all" ||
        task.department === departmentFilter ||
        (task.assigned_to_user ? staff.find((s) => s.id === task.assigned_to)?.department === departmentFilter : false)
    }

    const matchesStaff =
      staffFilter === "all" ||
      task.assigned_to === staffFilter ||
      task.assigned_users?.some((u: any) => u.id === staffFilter)

    return matchesSearch && matchesStatus && matchesPriority && matchesDepartment && matchesStaff
  })

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
      case "medium":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "low":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="from-background via-background to-muted/20 min-h-screen w-full overflow-x-hidden bg-gradient-to-br">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
                <ClipboardList className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
                Task Management
              </h1>
            </div>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Create and manage tasks for your team</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Tasks</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                  <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Pending</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.pending}</p>
                </div>
                <div className="rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900/30">
                  <ClipboardList className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">In Progress</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.in_progress}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                  <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Completed</p>
                  <p className="text-foreground mt-2 text-3xl font-bold">{stats.completed}</p>
                </div>
                <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/30">
                  <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              {userProfile?.role !== "lead" && (
                <SearchableSelect
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
                  placeholder="All Departments"
                  searchPlaceholder="Search departments..."
                  icon={<Building2 className="h-4 w-4" />}
                  className="w-full md:w-48"
                  options={[
                    { value: "all", label: "All Departments" },
                    ...departments.map((dept) => ({
                      value: dept,
                      label: dept,
                      icon: <Building2 className="h-3 w-3" />,
                    })),
                  ]}
                />
              )}
              <SearchableSelect
                value={staffFilter}
                onValueChange={setStaffFilter}
                placeholder={
                  userProfile?.role === "lead" && departments.length > 0
                    ? `All ${departments.length === 1 ? departments[0] : "Department"} Staff`
                    : "All Staff"
                }
                searchPlaceholder="Search staff..."
                icon={<User className="h-4 w-4" />}
                className="w-full md:w-48"
                options={[
                  {
                    value: "all",
                    label:
                      userProfile?.role === "lead" && departments.length > 0
                        ? `All ${departments.length === 1 ? departments[0] : "Department"} Staff`
                        : "All Staff",
                  },
                  ...staff.map((member) => ({
                    value: member.id,
                    label: `${formatName(member.first_name)} ${formatName(member.last_name)} - ${member.department}`,
                    icon: <User className="h-3 w-3" />,
                  })),
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tasks List */}
        {filteredTasks.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task, index) => (
                      <TableRow key={task.id}>
                        <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <div className="text-foreground font-medium">{task.title}</div>
                            {task.description && (
                              <div className="text-muted-foreground mt-1 line-clamp-1 text-sm">{task.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.assignment_type === "multiple" && task.assigned_users ? (
                            <div className="text-sm">
                              <div className="text-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{task.assigned_users.length} people</span>
                              </div>
                              <div className="text-muted-foreground mt-1 text-xs">
                                {task.assigned_users
                                  .slice(0, 2)
                                  .map((u: any) => `${formatName(u.first_name)} ${formatName(u.last_name)}`)
                                  .join(", ")}
                                {task.assigned_users.length > 2 && ` +${task.assigned_users.length - 2} more`}
                              </div>
                            </div>
                          ) : task.assignment_type === "department" && task.department ? (
                            <div className="text-sm">
                              <div className="text-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                <span>{task.department}</span>
                              </div>
                              <div className="text-muted-foreground text-xs">Department</div>
                            </div>
                          ) : task.assigned_to_user ? (
                            <div className="text-sm">
                              <div className="text-foreground">
                                {formatName((task.assigned_to_user as any)?.first_name)}{" "}
                                {formatName((task.assigned_to_user as any)?.last_name)}
                              </div>
                              {task.department && (
                                <div className="text-muted-foreground text-xs">{task.department}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <span className="text-foreground text-sm">{formatDate(task.due_date)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">No due date</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenTaskDialog(task)}
                              className="h-8 w-8 p-0"
                              title="Edit task"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTaskToDelete(task)
                                setIsDeleteDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Delete task"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTasks.map((task) => (
                <Card key={task.id} className="border-2 transition-shadow hover:shadow-lg">
                  <CardHeader className="from-primary/5 to-background border-b bg-gradient-to-r">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    {task.description && (
                      <p className="text-muted-foreground line-clamp-2 text-sm">{task.description}</p>
                    )}

                    {task.assignment_type === "multiple" && task.assigned_users ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="text-muted-foreground h-4 w-4" />
                        <span className="text-muted-foreground">Assigned to:</span>
                        <span className="text-foreground font-medium">{task.assigned_users.length} people</span>
                      </div>
                    ) : task.assignment_type === "department" && task.department ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="text-muted-foreground h-4 w-4" />
                        <span className="text-muted-foreground">Department:</span>
                        <span className="text-foreground font-medium">{task.department}</span>
                      </div>
                    ) : (
                      task.assigned_to_user && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="text-muted-foreground h-4 w-4" />
                          <span className="text-muted-foreground">Assigned to:</span>
                          <span className="text-foreground font-medium">
                            {formatName((task.assigned_to_user as any)?.first_name)}{" "}
                            {formatName((task.assigned_to_user as any)?.last_name)}
                          </span>
                        </div>
                      )
                    )}

                    {task.due_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="text-muted-foreground h-4 w-4" />
                        <span className="text-muted-foreground">Due:</span>
                        <span className="text-foreground">{formatDate(task.due_date)}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenTaskDialog(task)}
                        className="flex-1 gap-2"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTaskToDelete(task)
                          setIsDeleteDialogOpen(true)
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <ClipboardList className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">No Tasks Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                  ? "No tasks match your filters"
                  : "Get started by creating your first task"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask ? "Edit Task" : "Create New Task"}</DialogTitle>
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
                    const selectedStaff = staff.find((s) => s.id === value)
                    setTaskForm({
                      ...taskForm,
                      assigned_to: value,
                      department: selectedStaff?.department || "",
                    })
                  }}
                  placeholder="Select staff member"
                  searchPlaceholder="Search staff..."
                  icon={<User className="h-4 w-4" />}
                  options={staff.map((member) => ({
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
                      {staff.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">No staff members found</p>
                      ) : (
                        staff.map((member) => (
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
                  {taskForm.assigned_users.length} staff member{taskForm.assigned_users.length !== 1 ? "s" : ""}{" "}
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
                      <div className="text-muted-foreground p-4 text-center text-sm">No departments found</div>
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
                  All staff in this department will see this task. Only department leads, admins, and super admins can
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
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTask}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task "{taskToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleDeleteTask} loading={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
