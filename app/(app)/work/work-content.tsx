"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Briefcase, Building2, Calendar, CheckCircle2, Clock, Eye, HeadphonesIcon, Search, TrendingUp, User } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type WorkItem = {
  id: string
  title: string
  work_item_number?: string | null
  source_type?: string | null
  status: string
  priority?: string | null
  department?: string | null
  due_date?: string | null
  assigned_by_name?: string
  source_id?: string | null
  project_id?: string | null
  created_at: string
}

function getSourceLabel(sourceType?: string | null) {
  switch (sourceType) {
    case "manual":
      return "Task"
    case "help_desk":
      return "Help Desk"
    case "action_item":
      return "Action Point"
    case "project_task":
      return "Project"
    default:
      return "Work"
  }
}

function getPriorityColor(priority?: string | null) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4" />
    case "in_progress":
      return <TrendingUp className="h-4 w-4" />
    case "pending":
      return <Clock className="h-4 w-4" />
    case "cancelled":
      return <AlertCircle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

function getSourceIcon(sourceType?: string | null) {
  switch (sourceType) {
    case "help_desk":
      return <HeadphonesIcon className="text-primary h-4 w-4" />
    case "project_task":
      return <Building2 className="text-primary h-4 w-4" />
    default:
      return <Briefcase className="text-primary h-4 w-4" />
  }
}

function formatDueDate(dateString?: string | null) {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getDueDateClassName(item: WorkItem) {
  if (!item.due_date) return "text-muted-foreground"
  if (item.status === "completed" || item.status === "cancelled") {
    return "font-medium text-green-600 dark:text-green-400"
  }

  const dueDate = new Date(item.due_date)
  if (Number.isNaN(dueDate.getTime())) return "text-muted-foreground"
  if (dueDate.getTime() < Date.now()) {
    return "font-semibold text-red-600 dark:text-red-400"
  }

  return "font-semibold text-yellow-600 dark:text-yellow-400"
}

export function WorkContent({ initialItems }: { initialItems: WorkItem[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return initialItems.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        String(item.work_item_number || "")
          .toLowerCase()
          .includes(normalizedSearch)
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesSource = sourceFilter === "all" || getSourceLabel(item.source_type).toLowerCase() === sourceFilter
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter
      return matchesSearch && matchesStatus && matchesSource && matchesPriority
    })
  }, [initialItems, priorityFilter, search, sourceFilter, statusFilter])

  const stats = {
    total: initialItems.length,
    pending: initialItems.filter((item) => item.status === "pending").length,
    inProgress: initialItems.filter((item) => item.status === "in_progress").length,
    overdue: initialItems.filter(
      (item) => item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed"
    ).length,
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="My Work"
        description="Everything assigned to you in one place"
        icon={Briefcase}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
          </CardHeader>
          <CardContent>{stats.pending}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
          </CardHeader>
          <CardContent>{stats.inProgress}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent>{stats.overdue}</CardContent>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by item, work number, or source"
              className="pl-10"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="help desk">Help Desk</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="action point">Action Point</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="mt-6 border-2">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">S/N</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                  No work items match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item, index) => {
                return (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 rounded-lg p-2">{getSourceIcon(item.source_type)}</div>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => item.work_item_number && navigator.clipboard.writeText(item.work_item_number)}
                            className="text-muted-foreground font-mono text-xs font-semibold hover:underline"
                          >
                            {item.work_item_number || "Work item"}
                          </button>
                          <div className="font-medium">{item.title}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(item.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(item.status)}
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.priority ? <Badge className={getPriorityColor(item.priority)}>{item.priority}</Badge> : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getSourceLabel(item.source_type)}</Badge>
                    </TableCell>
                    <TableCell>{item.department || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <User className="text-muted-foreground h-3 w-3" />
                        <span>{item.assigned_by_name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.due_date ? (
                        <div className={`flex items-center gap-1 text-sm ${getDueDateClassName(item)}`}>
                          <Calendar className="text-muted-foreground h-3 w-3" />
                          <span>{formatDueDate(item.due_date)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (item.source_type === "help_desk" && item.source_id) {
                            router.push(`/help-desk/${item.source_id}`)
                            return
                          }
                          if (item.source_type === "project_task" && item.project_id) {
                            router.push(`/projects/${item.project_id}`)
                            return
                          }
                          router.push("/tasks/management")
                        }}
                        className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
                      >
                        <Eye className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Open</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          </Table>
        </div>
      </Card>
    </PageWrapper>
  )
}
