"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ScrollText, Search, Filter, Calendar, User, FileText, LayoutGrid, List, Eye } from "lucide-react"
import { formatName } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  old_values?: any
  new_values?: any
  created_at: string
  user?: {
    first_name: string
    last_name: string
    company_email: string
  }
  target_user?: {
    first_name: string
    last_name: string
    company_email: string
  }
  task_info?: {
    title: string
    assigned_to?: string
    assigned_to_user?: {
      first_name: string
      last_name: string
    }
  }
  device_info?: {
    device_name: string
    assigned_to?: string
    assigned_to_user?: {
      first_name: string
      last_name: string
    }
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      // Fetch audit logs without join first
      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      if (logsError) {
        console.error("Audit logs error details:", logsError)

        // Check if table doesn't exist
        if (logsError.message.includes("relation") && logsError.message.includes("does not exist")) {
          toast.error("Audit logs table not found. Please run the database migration first.")
        } else if (logsError.code === "PGRST301" || logsError.message.includes("permission")) {
          toast.error("Permission denied. You may not have access to view audit logs.")
        } else {
          toast.error(`Failed to load audit logs: ${logsError.message}`)
        }
        throw logsError
      }

      // If we have logs, fetch user details for each unique user_id and entity_id
      if (logsData && logsData.length > 0) {
        // Fetch users who performed actions
        const userIdsSet = new Set(logsData.map(log => log.user_id).filter(Boolean))
        const uniqueUserIds = Array.from(userIdsSet)

        // Separate entity IDs by type
        const userEntityIds = new Set(
          logsData
            .filter(log => 
              log.entity_id && 
              (log.entity_type === 'profile' || log.entity_type === 'user' || log.entity_type === 'pending_user')
            )
            .map(log => log.entity_id)
            .filter(Boolean)
        )

        const taskEntityIds = Array.from(new Set(
          logsData
            .filter(log => log.entity_id && log.entity_type === 'task')
            .map(log => log.entity_id)
            .filter(Boolean)
        ))

        const deviceEntityIds = Array.from(new Set(
          logsData
            .filter(log => log.entity_id && (log.entity_type === 'device' || log.entity_type === 'device_assignment'))
            .map(log => log.entity_id)
            .filter(Boolean)
        ))

        // Combine all user IDs for a single query
        const allUserIds = Array.from(new Set([...uniqueUserIds, ...Array.from(userEntityIds) as string[]]))

        // Fetch all users
        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_email")
          .in("id", allUserIds)

        const usersMap = new Map(usersData?.map(user => [user.id, user]))

        // Fetch tasks if needed
        let tasksMap = new Map()
        if (taskEntityIds.length > 0) {
          const { data: tasksData } = await supabase
            .from("tasks")
            .select("id, title, assigned_to")
            .in("id", taskEntityIds)

          if (tasksData) {
            // Get assigned users for tasks
            const taskUserIds = Array.from(new Set(tasksData.map(t => t.assigned_to).filter(Boolean)))
            if (taskUserIds.length > 0) {
              const { data: taskUsersData } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", taskUserIds)

              const taskUsersMap = new Map(taskUsersData?.map(u => [u.id, u]))
              
              tasksMap = new Map(tasksData.map(task => [
                task.id,
                {
                  title: task.title,
                  assigned_to: task.assigned_to,
                  assigned_to_user: task.assigned_to ? taskUsersMap.get(task.assigned_to) : null
                }
              ]))
            } else {
              tasksMap = new Map(tasksData.map(task => [task.id, { title: task.title }]))
            }
          }
        }

        // Fetch devices and their current assignments if needed
        let devicesMap = new Map()
        if (deviceEntityIds.length > 0) {
          const { data: devicesData } = await supabase
            .from("devices")
            .select("id, device_name")
            .in("id", deviceEntityIds)

          if (devicesData) {
            // Get current device assignments
            const { data: assignmentsData } = await supabase
              .from("device_assignments")
              .select("device_id, assigned_to")
              .in("device_id", deviceEntityIds)
              .eq("is_current", true)

            const assignmentsMap = new Map(assignmentsData?.map(a => [a.device_id, a.assigned_to]))
            
            // Get assigned users
            const deviceUserIds = Array.from(new Set(Array.from(assignmentsMap.values()).filter(Boolean)))
            let deviceUsersMap = new Map()
            if (deviceUserIds.length > 0) {
              const { data: deviceUsersData } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", deviceUserIds)

              deviceUsersMap = new Map(deviceUsersData?.map(u => [u.id, u]))
            }

            devicesMap = new Map(devicesData.map(device => {
              const assignedTo = assignmentsMap.get(device.id)
              return [
                device.id,
                {
                  device_name: device.device_name,
                  assigned_to: assignedTo,
                  assigned_to_user: assignedTo ? deviceUsersMap.get(assignedTo) : null
                }
              ]
            }))
          }
        }

        // Combine logs with all fetched data
        const logsWithUsers = logsData.map(log => {
          let targetFromNewValues = null
          
          // Check new_values for assigned_to if we don't have task/device info
          if (log.entity_type === 'task' && !tasksMap.get(log.entity_id) && log.new_values?.assigned_to) {
            targetFromNewValues = usersMap.get(log.new_values.assigned_to)
          }
          
          if ((log.entity_type === 'device' || log.entity_type === 'device_assignment') && !devicesMap.get(log.entity_id) && log.new_values?.assigned_to) {
            targetFromNewValues = usersMap.get(log.new_values.assigned_to)
          }
          
          return {
            ...log,
            user: log.user_id ? usersMap.get(log.user_id) : null,
            target_user: log.entity_id ? usersMap.get(log.entity_id) : (targetFromNewValues || null),
            task_info: log.entity_id && log.entity_type === 'task' ? tasksMap.get(log.entity_id) : null,
            device_info: log.entity_id && (log.entity_type === 'device' || log.entity_type === 'device_assignment') ? devicesMap.get(log.entity_id) : null
          }
        })

        console.log("Loaded audit logs count:", logsWithUsers.length)
        setLogs(logsWithUsers as any)
      } else {
        console.log("No audit logs found")
        setLogs([])
      }
    } catch (error: any) {
      console.error("Error loading audit logs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user as any)?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user as any)?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesAction = actionFilter === "all" || log.action === actionFilter
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter

    let matchesDate = true
    if (dateFilter !== "all") {
      const logDate = new Date(log.created_at)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))

      switch (dateFilter) {
        case "today":
          matchesDate = daysDiff === 0
          break
        case "week":
          matchesDate = daysDiff <= 7
          break
        case "month":
          matchesDate = daysDiff <= 30
          break
        case "custom":
          if (customStartDate && customEndDate) {
            const startDate = new Date(customStartDate)
            const endDate = new Date(customEndDate)
            // Set end date to end of day
            endDate.setHours(23, 59, 59, 999)
            matchesDate = logDate >= startDate && logDate <= endDate
          } else if (customStartDate) {
            const startDate = new Date(customStartDate)
            matchesDate = logDate >= startDate
          } else if (customEndDate) {
            const endDate = new Date(customEndDate)
            endDate.setHours(23, 59, 59, 999)
            matchesDate = logDate <= endDate
          }
          break
      }
    }

    return matchesSearch && matchesAction && matchesEntity && matchesDate
  })

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "update":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "delete":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "assign":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTargetDescription = (log: AuditLog) => {
    const action = log.action.toLowerCase()
    const entityType = log.entity_type.toLowerCase()
    
    // First priority: Check if we have target_user (this handles all user-related targets including tasks)
    if (log.target_user && (entityType === 'profile' || entityType === 'user' || entityType === 'pending_user' || entityType === 'task' || entityType === 'device' || entityType === 'device_assignment' || entityType === 'job_description')) {
      const name = `${formatName(log.target_user.first_name)} ${formatName(log.target_user.last_name)}`
      return name
    }
    
    // Handle task-related logs with task_info
    if (entityType === 'task' && log.task_info) {
      if (log.task_info.assigned_to_user) {
        const name = `${formatName(log.task_info.assigned_to_user.first_name)} ${formatName(log.task_info.assigned_to_user.last_name)}`
        return name
      }
    }
    
    // Handle device-related logs with device_info
    if ((entityType === 'device' || entityType === 'device_assignment') && log.device_info) {
      if (log.device_info.assigned_to_user) {
        const name = `${formatName(log.device_info.assigned_to_user.first_name)} ${formatName(log.device_info.assigned_to_user.last_name)}`
        return name
      }
      // Devices can be unassigned
      return "-"
    }
    
    // Handle user-related logs
    if (entityType === 'profile' || entityType === 'user' || entityType === 'pending_user') {
      // Check new_values for user creation
      if (log.new_values?.first_name && log.new_values?.last_name) {
        return `${formatName(log.new_values.first_name)} ${formatName(log.new_values.last_name)}`
      }
      return "User"
    }
    
    // Handle documentation - target is the person who created it (the user performing the action)
    if (entityType === 'user_documentation' || entityType === 'documentation') {
      if (log.user) {
        const name = `${formatName(log.user.first_name)} ${formatName(log.user.last_name)}`
        return name
      }
      return "Documentation"
    }
    
    // Handle feedback - target is the person who submitted it
    if (entityType === 'feedback') {
      if (log.user) {
        const name = `${formatName(log.user.first_name)} ${formatName(log.user.last_name)}`
        return name
      }
      return "Feedback"
    }
    
    // Fallback for devices without assignment
    if (entityType === 'device' || entityType === 'device_assignment') {
      return "-"
    }
    
    // For any other entity types, capitalize and show nicely
    if (log.entity_id) {
      return entityType.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }
    
    return "N/A"
  }

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log)
    setIsDetailsOpen(true)
  }

  const formatValues = (values: any) => {
    if (!values) return null

    try {
      return (
        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
          <pre className="text-xs text-muted-foreground overflow-x-auto">
            {JSON.stringify(values, null, 2)}
          </pre>
        </div>
      )
    } catch {
      return null
    }
  }

  const stats = {
    total: logs.length,
    creates: logs.filter((l) => l.action === "create").length,
    updates: logs.filter((l) => l.action === "update").length,
    deletes: logs.filter((l) => l.action === "delete").length,
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ScrollText className="h-8 w-8 text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground mt-2">
              Complete audit trail of all system activities
            </p>
          </div>
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Card
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Actions</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ScrollText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Creates</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.creates}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Updates</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.updates}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Deletes</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{stats.deletes}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="assign">Assign</SelectItem>
                </SelectContent>
              </Select>

              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="device">Devices</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="job_description">Job Descriptions</SelectItem>
                  <SelectItem value="user_documentation">Documentation</SelectItem>
                  <SelectItem value="profile">Profiles</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={(value) => {
                setDateFilter(value)
                if (value !== "custom") {
                  setCustomStartDate("")
                  setCustomEndDate("")
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Time Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === "custom" && (
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="pl-10"
                      placeholder="Select start date"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="pl-10"
                      placeholder="Select end date"
                      min={customStartDate}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Logs List */}
        {filteredLogs.length > 0 ? (
          viewMode === "list" ? (
            <Card className="border-2">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Target/Affected</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>
                          {log.action.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {log.entity_type.replace("_", " ").toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">
                          {getTargetDescription(log)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground">
                            {formatName((log.user as any)?.first_name)} {formatName((log.user as any)?.last_name)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <Card key={log.id} className="border-2 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={getActionColor(log.action)}>
                            {log.action.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">
                            {log.entity_type.replace("_", " ").toUpperCase()}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {getTargetDescription(log)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">By:</span>
                            <span className="text-foreground">
                              {formatName((log.user as any)?.first_name)} {formatName((log.user as any)?.last_name)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
                          </div>
                        </div>

                        {log.old_values && (
                          <details className="mt-2">
                            <summary className="text-sm font-medium text-foreground cursor-pointer hover:text-primary">
                              Old Values
                            </summary>
                            {formatValues(log.old_values)}
                          </details>
                        )}

                        {log.new_values && (
                          <details className="mt-2">
                            <summary className="text-sm font-medium text-foreground cursor-pointer hover:text-primary">
                              New Values
                            </summary>
                            {formatValues(log.new_values)}
                          </details>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(log)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
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
              <ScrollText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Audit Logs Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || actionFilter !== "all" || entityFilter !== "all" || dateFilter !== "all"
                  ? "No logs match your filters"
                  : "No audit logs available yet"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pagination info */}
        {filteredLogs.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} total logs
            {logs.length >= 500 && " (limited to last 500 entries)"}
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Audit Log Details</DialogTitle>
            <DialogDescription>Complete information about this audit event</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Action and Entity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Action</Label>
                  <div>
                    <Badge className={getActionColor(selectedLog.action)}>
                      {selectedLog.action.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Entity Type</Label>
                  <div className="text-sm font-medium">
                    {selectedLog.entity_type.replace("_", " ").toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Target/Affected */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Target/Affected</Label>
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <p className="text-sm font-medium">{getTargetDescription(selectedLog)}</p>
                  {selectedLog.target_user && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedLog.target_user.company_email}
                    </p>
                  )}
                  {selectedLog.task_info && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Task: {selectedLog.task_info.title}</p>
                      {selectedLog.task_info.assigned_to_user && (
                        <p className="text-xs text-muted-foreground">
                          Assigned to: {formatName(selectedLog.task_info.assigned_to_user.first_name)} {formatName(selectedLog.task_info.assigned_to_user.last_name)}
                        </p>
                      )}
                    </div>
                  )}
                  {selectedLog.device_info && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Device: {selectedLog.device_info.device_name}</p>
                      {selectedLog.device_info.assigned_to_user && (
                        <p className="text-xs text-muted-foreground">
                          Assigned to: {formatName(selectedLog.device_info.assigned_to_user.first_name)} {formatName(selectedLog.device_info.assigned_to_user.last_name)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Performed By */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Performed By</Label>
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {formatName((selectedLog.user as any)?.first_name)} {formatName((selectedLog.user as any)?.last_name)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedLog.user as any)?.company_email}
                  </p>
                </div>
              </div>

              {/* Date and Time */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Date & Time</Label>
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(selectedLog.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Old Values */}
              {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Old Values</Label>
                  <div className="p-4 bg-muted/50 rounded-lg border max-h-60 overflow-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* New Values */}
              {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">New Values</Label>
                  <div className="p-4 bg-muted/50 rounded-lg border max-h-60 overflow-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Entity ID */}
              {selectedLog.entity_id && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Entity ID</Label>
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <code className="text-xs font-mono break-all">{selectedLog.entity_id}</code>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => setIsDetailsOpen(false)} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
