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
import { ScrollText, Search, Filter, Calendar, User, FileText, LayoutGrid, List } from "lucide-react"
import { formatName } from "@/lib/utils"

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

      // If we have logs, fetch user details for each unique user_id
      if (logsData && logsData.length > 0) {
        const userIdsSet = new Set(logsData.map(log => log.user_id).filter(Boolean))
        const uniqueUserIds = Array.from(userIdsSet)

        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, company_email")
          .in("id", uniqueUserIds)

        // Create a map of user data
        const usersMap = new Map(usersData?.map(user => [user.id, user]))

        // Combine logs with user data
        const logsWithUsers = logsData.map(log => ({
          ...log,
          user: log.user_id ? usersMap.get(log.user_id) : null
        }))

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
                    <TableHead>Entity ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
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
                        {log.entity_id ? (
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.entity_id.substring(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
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
                        <div className="flex items-center gap-3">
                          <Badge className={getActionColor(log.action)}>
                            {log.action.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">
                            {log.entity_type.replace("_", " ").toUpperCase()}
                          </span>
                          {log.entity_id && (
                            <span className="text-xs text-muted-foreground font-mono">
                              ID: {log.entity_id.substring(0, 8)}...
                            </span>
                          )}
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
    </div>
  )
}
