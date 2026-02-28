"use client"

import { useState, useEffect, Suspense, Fragment } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"
import { toast } from "sonner"
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  FileText,
  File as FileIcon,
  Presentation,
  ExternalLink,
  Edit2,
  Trash2,
  MoreVertical,
} from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ActionFormDialog } from "@/components/admin/action-tracker/action-form-dialog"
import {
  exportActionTrackerToPDF,
  exportActionTrackerToPPTX,
  exportActionTrackerToDocx,
  type ActionItem,
} from "@/lib/export-utils"

interface ActionTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  department: string
  due_date?: string
  week_number: number
  year: number
  original_week?: number
}

interface ActionTrackerContentProps {
  initialDepartments: string[]
  scopedDepartments?: string[]
}

export function ActionTrackerContent({ initialDepartments, scopedDepartments = [] }: ActionTrackerContentProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [tasks, setTasks] = useState<ActionTask[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ActionTask | null>(null)

  const [weekFilter, setWeekFilter] = useState(() => {
    const w = searchParams.get("week")
    return w ? parseInt(w) : currentOfficeWeek.week
  })
  const [yearFilter, setYearFilter] = useState(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y) : currentOfficeWeek.year
  })
  const [deptFilter, setDeptFilter] = useState(() => {
    const d = searchParams.get("dept")
    return d || "all"
  })
  const [searchQuery, setSearchQuery] = useState("")

  const supabase = createClient()

  const loadTasks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("action_items")
        .select("*")
        .eq("week_number", weekFilter)
        .eq("year", yearFilter)
        .order("department", { ascending: true })
        .order("created_at", { ascending: true })

      if (scopedDepartments.length > 0) {
        query = query.in("department", scopedDepartments)
      }

      if (deptFilter !== "all") {
        query = query.eq("department", deptFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error("Error loading tasks:", error)
      toast.error("Failed to load actions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [weekFilter, yearFilter, deptFilter])

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Optimistic update
    const previousTasks = [...tasks]
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))

    try {
      const { error } = await supabase
        .from("action_items")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId)

      if (error) throw error
      toast.success("Status updated")
    } catch (error) {
      console.error(error)
      setTasks(previousTasks)
      toast.error("Failed to update status")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this action?")) return
    try {
      const { error } = await supabase.from("action_items").delete().eq("id", id)
      if (error) throw error
      toast.success("Action deleted")
      loadTasks()
    } catch (error) {
      toast.error("Failed to delete")
    }
  }

  const handleEdit = (task: ActionTask) => {
    setEditingTask(task)
    setIsFormOpen(true)
  }

  const toggleDept = (dept: string) => {
    const next = new Set(expandedDepts)
    if (next.has(dept)) next.delete(dept)
    else next.add(dept)
    setExpandedDepts(next)
  }

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group by department
  const deptsPresent = Array.from(new Set(filteredTasks.map((t) => t.department))).sort()

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    pending: tasks.filter((t) => t.status !== "completed").length,
  }

  const getDeptStatus = (dept: string) => {
    const deptActions = tasks.filter((t) => t.department === dept)
    if (deptActions.length === 0)
      return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }

    if (deptActions.every((a) => a.status === "completed")) {
      return { label: "Finished", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
    }
    if (deptActions.some((a) => a.status === "in_progress" || a.status === "completed")) {
      return { label: "Started", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" }
    }
    return { label: "Pending", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400" }
  }

  const statusColor = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    if (status === "in_progress") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    if (status === "not_started") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
    return "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400"
  }

  const actionItemsForExport: ActionItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    department: t.department,
    status: t.status,
    week_number: t.week_number,
    year: t.year,
  }))

  return (
    <AdminTablePage
      title="Action Tracker"
      description="Monitor and manage weekly departmental actions"
      icon={FileSpreadsheet}
      backLinkHref="/admin/reports"
      backLinkLabel="Back to Reports"
      actions={
        tasks.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportActionTrackerToPDF(actionItemsForExport, weekFilter, yearFilter)}
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:hover:bg-red-950/20"
            >
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => exportActionTrackerToPPTX(actionItemsForExport, weekFilter, yearFilter)}
              className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900/30 dark:hover:bg-orange-950/20"
            >
              <Presentation className="h-4 w-4" /> <span className="hidden sm:inline">PPTX</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => exportActionTrackerToDocx(actionItemsForExport, weekFilter, yearFilter)}
              className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/30 dark:hover:bg-blue-950/20"
            >
              <FileIcon className="h-4 w-4" /> <span className="hidden sm:inline">Word</span>
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900/30 dark:hover:bg-green-950/20"
            >
              <Link href="/admin/communications/meetings/mail">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">General Meeting Mail</span>
              </Link>
            </Button>
          </div>
        ) : null
      }
      stats={
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Actions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileSpreadsheet className="h-8 w-8 text-blue-500 opacity-20" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-20" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-20" />
            </CardContent>
          </Card>
        </div>
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by description or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-24">
              <Label className="text-muted-foreground mb-1.5 block px-1 text-[10px] font-bold tracking-wider uppercase">
                Week
              </Label>
              <Input
                type="number"
                value={weekFilter}
                onChange={(e) => setWeekFilter(parseInt(e.target.value) || weekFilter)}
              />
            </div>
            <div className="w-28">
              <Label className="text-muted-foreground mb-1.5 block px-1 text-[10px] font-bold tracking-wider uppercase">
                Year
              </Label>
              <Input
                type="number"
                value={yearFilter}
                onChange={(e) => setYearFilter(parseInt(e.target.value) || yearFilter)}
              />
            </div>
            <div className="w-52">
              <Label className="text-muted-foreground mb-1.5 block px-1 text-[10px] font-bold tracking-wider uppercase">
                Department
              </Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {initialDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={loadTasks} disabled={loading} className="h-10 w-10 shrink-0">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      }
    >
      <div className="bg-background dark:bg-card overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="font-bold">Department</TableHead>
              <TableHead className="font-bold">Tasks Count</TableHead>
              <TableHead className="text-center font-bold">Summary Status</TableHead>
              <TableHead className="w-[100px] text-right font-bold"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Auditing actions...
                  </div>
                </TableCell>
              </TableRow>
            ) : deptsPresent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-32 text-center font-medium">
                  No actions found for this week.
                </TableCell>
              </TableRow>
            ) : (
              deptsPresent.map((dept) => {
                const deptActions = tasks.filter((t) => t.department === dept)
                const completedCount = deptActions.filter((a) => a.status === "completed").length
                const totalCount = deptActions.length
                const status = getDeptStatus(dept)

                return (
                  <Fragment key={dept}>
                    <TableRow
                      className={cn(
                        "hover:bg-muted/30 cursor-pointer transition-colors",
                        expandedDepts.has(dept) && "bg-muted/50"
                      )}
                      onClick={() => toggleDept(dept)}
                    >
                      <TableCell>
                        {expandedDepts.has(dept) ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell className="text-foreground font-bold">{dept}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {completedCount} of {totalCount} items completed
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn("px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase", status.color)}
                        >
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
                          {expandedDepts.has(dept) ? "Hide" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedDepts.has(dept) && (
                      <TableRow className="bg-muted/10 hover:bg-muted/10 border-t-0">
                        <TableCell colSpan={5} className="p-0">
                          <div className="animate-in slide-in-from-top-2 p-6 pt-2 duration-200">
                            <div className="bg-background overflow-hidden rounded-lg border shadow-sm">
                              <Table>
                                <TableHeader className="bg-muted/30">
                                  <TableRow>
                                    <TableHead className="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
                                      Action Item (Task)
                                    </TableHead>
                                    <TableHead className="text-muted-foreground w-[150px] text-[10px] font-black tracking-widest uppercase">
                                      Status
                                    </TableHead>
                                    <TableHead className="w-[80px] text-right"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {deptActions.map((task) => (
                                    <TableRow key={task.id} className="hover:bg-muted/5">
                                      <TableCell>
                                        <div className="text-sm font-semibold">{task.title}</div>
                                        {task.description && (
                                          <div className="text-muted-foreground mt-0.5 text-xs">{task.description}</div>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={task.status}
                                          onValueChange={(val) => handleStatusChange(task.id, val)}
                                        >
                                          <SelectTrigger
                                            className={cn(
                                              "h-8 w-full justify-between text-[11px] font-bold uppercase",
                                              statusColor(task.status)
                                            )}
                                          >
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="pending" className="text-xs">
                                              Pending
                                            </SelectItem>
                                            <SelectItem value="not_started" className="text-xs">
                                              Not Started
                                            </SelectItem>
                                            <SelectItem value="in_progress" className="text-xs">
                                              In Progress
                                            </SelectItem>
                                            <SelectItem value="completed" className="text-xs">
                                              Completed
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(task)} className="gap-2">
                                              <Edit2 className="h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleDelete(task.id)}
                                              className="text-destructive gap-2"
                                            >
                                              <Trash2 className="h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ActionFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onComplete={loadTasks}
        departments={initialDepartments}
        editingAction={editingTask}
        defaultWeek={weekFilter}
        defaultYear={yearFilter}
      />
    </AdminTablePage>
  )
}
