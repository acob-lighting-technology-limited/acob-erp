"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  AlertDialog,
  AlertDialogAction,
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
  Filter,
  Calendar,
  User,
  LayoutGrid,
  List,
  Users,
  Building2,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  assigned_to: string
  assigned_by: string
  department?: string
  due_date?: string
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
}

interface Staff {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
}

interface UserProfile {
  role: string
  lead_departments?: string[]
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [staffFilter, setStaffFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")

  // Dialog states
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  // Form states
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
  })

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, lead_departments")
        .eq("id", user.id)
        .single()

      setUserProfile(profile)

      // Build query based on role
      let tasksQuery = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })

      // Filter by department for leads - STRICTLY by their departments
      if (profile?.role === "lead" && profile?.lead_departments && profile.lead_departments.length > 0) {
        tasksQuery = tasksQuery.in("department", profile.lead_departments)
      }

      // Fetch staff - leads can only see staff in their departments
      let staffQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, department")
        .order("last_name", { ascending: true })

      // Filter staff by lead's departments
      if (profile?.role === "lead" && profile?.lead_departments && profile.lead_departments.length > 0) {
        staffQuery = staffQuery.in("department", profile.lead_departments)
      }

      const [tasksData, staffData] = await Promise.all([
        tasksQuery,
        staffQuery,
      ])

      if (tasksData.error) throw tasksData.error
      if (staffData.error) throw staffData.error

      console.log("Loaded staff count:", staffData.data?.length)

      // Fetch task assignments and user details
      const tasksWithUsers = await Promise.all((tasksData.data || []).map(async (task: any) => {
        const taskData: any = { ...task }
        
        // For individual tasks, fetch assigned user
        if (task.assignment_type === "individual" && task.assigned_to) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name, department")
            .eq("id", task.assigned_to)
            .single()
          
          taskData.assigned_to_user = userProfile
        }
        
        // For multiple-user tasks, fetch all assignments
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
            
            // Fetch completion status
            const { data: completions } = await supabase
              .from("task_user_completion")
              .select("user_id")
              .eq("task_id", task.id)
            
            const completedUserIds = new Set(completions?.map((c: any) => c.user_id) || [])
            
            taskData.assigned_users = userProfiles?.map((profile: any) => ({
              ...profile,
              completed: completedUserIds.has(profile.id)
            })) || []
          }
        }
        
        return taskData
      }))

      // For leads, filter tasks strictly by their departments
      let filteredTasks = tasksWithUsers as any || []
      if (profile?.role === "lead" && profile?.lead_departments && profile.lead_departments.length > 0) {
        filteredTasks = filteredTasks.filter((task: any) => {
          // Check if task department is in lead's departments
          if (task.department && profile.lead_departments.includes(task.department)) {
            return true
          }
          // Check if assigned user is in lead's departments
          if (task.assigned_to_user?.department && profile.lead_departments.includes(task.assigned_to_user.department)) {
            return true
          }
          // Check if any assigned user in multiple-user tasks is in lead's departments
          if (task.assigned_users && task.assigned_users.length > 0) {
            return task.assigned_users.some((u: any) => 
              u.department && profile.lead_departments.includes(u.department)
            )
          }
          return false
        })
      }

      setTasks(filteredTasks)
      setStaff(staffData.data || [])
      
      // Get unique departments - for leads, only show their lead departments
      let uniqueDepartments: string[] = []
      if (profile?.role === "lead" && profile?.lead_departments && profile.lead_departments.length > 0) {
        uniqueDepartments = profile.lead_departments.sort()
      } else {
        uniqueDepartments = Array.from(
          new Set(staffData.data?.map((s: any) => s.department).filter(Boolean))
        ) as string[]
        uniqueDepartments.sort()
      }
      setDepartments(uniqueDepartments)
    } catch (error: any) {
      console.error("Error loading data:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load data"
      toast.error(`Failed to load data: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenTaskDialog = async (task?: Task) => {
    if (task) {
      setSelectedTask(task)
      
      // Load assignment data for multiple-user tasks
      let assignedUsers: string[] = []
      if (task.assignment_type === "multiple" && task.id) {
        const { data: assignments } = await supabase
          .from("task_assignments")
          .select("user_id")
          .eq("task_id", task.id)
        
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
      })
    }
    setIsTaskDialogOpen(true)
  }

  const handleSaveTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Validate based on assignment type
      if (taskForm.assignment_type === "individual" && !taskForm.assigned_to) {
        toast.error("Please select a staff member for individual assignment")
        return
      }
      if (taskForm.assignment_type === "multiple" && taskForm.assigned_users.length === 0) {
        toast.error("Please select at least one staff member for multiple assignment")
        return
      }
      if (taskForm.assignment_type === "department" && !taskForm.department) {
        toast.error("Please select a department for department assignment")
        return
      }

      const taskData: any = {
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        status: taskForm.status,
        due_date: taskForm.due_date || null,
        department: taskForm.assignment_type === "department" ? taskForm.department : null,
        assignment_type: taskForm.assignment_type,
        assigned_to: taskForm.assignment_type === "individual" ? taskForm.assigned_to : null,
        assigned_by: user.id,
      }

      if (selectedTask) {
        // Update existing task
        const { error: taskError } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", selectedTask.id)

        if (taskError) throw taskError

        // Update task assignments for multiple-user tasks
        if (taskForm.assignment_type === "multiple") {
          // Delete existing assignments
          await supabase
            .from("task_assignments")
            .delete()
            .eq("task_id", selectedTask.id)

          // Insert new assignments
          if (taskForm.assigned_users.length > 0) {
            const assignments = taskForm.assigned_users.map((userId: string) => ({
              task_id: selectedTask.id,
              user_id: userId,
            }))

            const { error: assignError } = await supabase
              .from("task_assignments")
              .insert(assignments)

            if (assignError) throw assignError
          }
        }

        // Log update
        await supabase.from("task_updates").insert({
          task_id: selectedTask.id,
          user_id: user.id,
          update_type: "task_updated",
          content: "Task details updated by admin",
        })

        // Log audit
        await supabase.rpc("log_audit", {
          p_action: "update",
          p_entity_type: "task",
          p_entity_id: selectedTask.id,
          p_new_values: taskData,
        })

        toast.success("Task updated successfully")
      } else {
        // Create new task
        const { data: newTask, error: taskError } = await supabase
          .from("tasks")
          .insert(taskData)
          .select()
          .single()

        if (taskError) throw taskError

        // Create task assignments for multiple-user tasks
        if (taskForm.assignment_type === "multiple" && taskForm.assigned_users.length > 0) {
          const assignments = taskForm.assigned_users.map((userId: string) => ({
            task_id: newTask.id,
            user_id: userId,
          }))

          const { error: assignError } = await supabase
            .from("task_assignments")
            .insert(assignments)

          if (assignError) throw assignError
        }

        // Log audit
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
    }
  }

  const handleDeleteTask = async () => {
    try {
      if (!taskToDelete) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskToDelete.id)

      if (error) throw error

      // Log audit
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
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter

    // Filter by department - for leads, always filter by their departments
    let matchesDepartment = true
    if (userProfile?.role === "lead") {
      // Leads: tasks are already filtered, but ensure they match lead's departments
      if (userProfile.lead_departments && userProfile.lead_departments.length > 0) {
        const leadDepartments = userProfile.lead_departments
        matchesDepartment = leadDepartments.includes(task.department || "") ||
          (task.assigned_to_user ? leadDepartments.includes(task.assigned_to_user.department || "") : false) ||
          (task.assigned_users && task.assigned_users.some((u: any) =>
            u.department && leadDepartments.includes(u.department)
          )) || false
      }
    } else {
      // Admins: use department filter
      matchesDepartment = departmentFilter === "all" || 
        task.department === departmentFilter ||
        (task.assigned_to_user ? staff.find((s) => s.id === task.assigned_to)?.department === departmentFilter : false)
    }

    // Filter by staff
    const matchesStaff = staffFilter === "all" || 
      task.assigned_to === staffFilter ||
      (task.assigned_users && task.assigned_users.some((u: any) => u.id === staffFilter))

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-64"></div>
                <div className="h-5 bg-muted rounded w-96"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-10 bg-muted rounded w-32"></div>
                <div className="h-10 bg-muted rounded w-32"></div>
              </div>
            </div>

            {/* Stats Skeleton */}
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-2">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-24"></div>
                        <div className="h-8 bg-muted rounded w-16"></div>
                      </div>
                      <div className="h-12 w-12 bg-muted rounded-lg"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters Skeleton */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="h-10 bg-muted rounded flex-1"></div>
                  <div className="h-10 bg-muted rounded w-48"></div>
                  <div className="h-10 bg-muted rounded w-48"></div>
                  <div className="h-10 bg-muted rounded w-32"></div>
                </div>
              </CardContent>
            </Card>

            {/* Table/List Skeleton */}
            <Card className="border-2">
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded"></div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Task Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Create and manage tasks for your team
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center border rounded-lg p-1">
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
                  <p className="text-sm text-muted-foreground font-medium">Total Tasks</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pending</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.pending}</p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">In Progress</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.in_progress}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Completed</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.completed}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              {/* Department filter - hidden for leads */}
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
                    label: userProfile?.role === "lead" && departments.length > 0
                      ? `All ${departments.length === 1 ? departments[0] : "Department"} Staff`
                      : "All Staff"
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
              <div className="overflow-x-auto">
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
                          <div className="font-medium text-foreground">{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.assignment_type === "multiple" && task.assigned_users ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-foreground">
                              <Users className="h-3 w-3" />
                              <span>{task.assigned_users.length} people</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {task.assigned_users.slice(0, 2).map((u: any) => `${formatName(u.first_name)} ${formatName(u.last_name)}`).join(", ")}
                              {task.assigned_users.length > 2 && ` +${task.assigned_users.length - 2} more`}
                            </div>
                            {task.assigned_users.some((u: any) => u.completed) && (
                              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                {task.assigned_users.filter((u: any) => u.completed).length}/{task.assigned_users.length} completed
                              </div>
                            )}
                          </div>
                        ) : task.assignment_type === "department" && task.department ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-foreground">
                              <Building2 className="h-3 w-3" />
                              <span>{task.department}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">Department</div>
                          </div>
                        ) : task.assigned_to_user ? (
                          <div className="text-sm">
                            <div className="text-foreground">
                              {formatName((task.assigned_to_user as any)?.first_name)} {formatName((task.assigned_to_user as any)?.last_name)}
                            </div>
                            {task.department && (
                              <div className="text-xs text-muted-foreground">{task.department}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <span className="text-sm text-foreground">{formatDate(task.due_date)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap">
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
                <Card key={task.id} className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-background">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getStatusColor(task.status)}>
                            {task.status.replace("_", " ")}
                          </Badge>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {task.assignment_type === "multiple" && task.assigned_users ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Assigned to:</span>
                          <span className="text-foreground font-medium">
                            {task.assigned_users.length} people
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 pl-6">
                          {task.assigned_users.map((u: any, idx: number) => (
                            <div key={u.id} className="flex items-center gap-2">
                              <span>
                                {formatName(u.first_name)} {formatName(u.last_name)}
                              </span>
                              {u.completed && (
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                  Done
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : task.assignment_type === "department" && task.department ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Department:</span>
                        <span className="text-foreground font-medium">{task.department}</span>
                      </div>
                    ) : task.assigned_to_user && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Assigned to:</span>
                        <span className="text-foreground font-medium">
                          {formatName((task.assigned_to_user as any)?.first_name)} {formatName((task.assigned_to_user as any)?.last_name)}
                        </span>
                      </div>
                    )}

                    {task.due_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
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
              <ClipboardList className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Tasks Found</h3>
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
            <DialogTitle>
              {selectedTask ? "Edit Task" : "Create New Task"}
            </DialogTitle>
            <DialogDescription>
              {selectedTask
                ? "Update the task information below"
                : "Enter the details for the new task"}
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
                <Select
                  value={taskForm.status}
                  onValueChange={(value) => setTaskForm({ ...taskForm, status: value })}
                >
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

            {/* Individual Assignment */}
            {taskForm.assignment_type === "individual" && (
              <div>
                <Label htmlFor="assigned_to">Assign To *</Label>
                <Select
                  value={taskForm.assigned_to}
                  onValueChange={(value) => {
                    const selectedStaff = staff.find((s) => s.id === value)
                    setTaskForm({
                      ...taskForm,
                      assigned_to: value,
                      department: selectedStaff?.department || "",
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {staff.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No staff members found
                      </div>
                    ) : (
                      staff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.first_name} {member.last_name} - {member.department}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Multiple People Assignment */}
            {taskForm.assignment_type === "multiple" && (
              <div>
                <Label>Assign To Multiple People *</Label>
                <Card className="border-2 mt-2">
                  <ScrollArea className="h-[200px]">
                    <CardContent className="p-4 space-y-2">
                      {staff.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No staff members found
                        </p>
                      ) : (
                        staff.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md"
                          >
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
                                    assigned_users: taskForm.assigned_users.filter(
                                      (id) => id !== member.id
                                    ),
                                  })
                                }
                              }}
                            />
                            <label
                              htmlFor={`member-${member.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {member.first_name} {member.last_name} - {member.department}
                            </label>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </ScrollArea>
                </Card>
                <p className="text-xs text-muted-foreground mt-1">
                  {taskForm.assigned_users.length} staff member{taskForm.assigned_users.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}

            {/* Department Assignment */}
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
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No departments found
                      </div>
                    ) : (
                      departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  All staff in this department will see this task. Only department leads, admins, and super admins can change the status.
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTask}
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
              This will permanently delete the task "{taskToDelete?.title}". This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
