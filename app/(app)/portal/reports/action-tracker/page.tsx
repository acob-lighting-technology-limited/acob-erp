"use client"

import { useState, useEffect, Suspense, Fragment } from "react"
import { useSearchParams } from "next/navigation"
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
  MoreVertical,
} from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
}

export default function ActionTrackerPortal() {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [tasks, setTasks] = useState<ActionTask[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [profile, setProfile] = useState<any>(null)
  const [allDepartments, setAllDepartments] = useState<string[]>([])

  const [week, setWeek] = useState(() => {
    const w = searchParams.get("week")
    return w ? parseInt(w) : currentOfficeWeek.week
  })
  const [year, setYear] = useState(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y) : currentOfficeWeek.year
  })
  const [deptFilter, setDeptFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const supabase = createClient()

  useEffect(() => {
    const fetchMetadata = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single()
        setProfile(p)
      }
      const { data: depts } = await supabase.from("profiles").select("department").not("department", "is", null)
      if (depts) {
        setAllDepartments(
          Array.from(new Set(depts.map((d) => d.department)))
            .filter(Boolean)
            .sort() as string[]
        )
      }
    }
    fetchMetadata()
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("action_items")
        .select("*")
        .eq("week_number", week)
        .eq("year", year)
        .order("department", { ascending: true })

      if (deptFilter !== "all") {
        query = query.eq("department", deptFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error(error)
      toast.error("Failed to load actions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [week, year, deptFilter])

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // Critical security check: Only allow updates for user's own department
    if (profile?.department !== task.department) {
      toast.error("Unauthorized: You can only update statuses for your own department")
      return
    }

    try {
      const { error } = await supabase
        .from("action_items")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId)

      if (error) throw error
      toast.success("Status updated")
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
    } catch (error) {
      console.error(error)
      toast.error("Failed to update status")
    }
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
      t.department.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    if (deptActions.every((a) => a.status === "completed"))
      return { label: "Finished", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
    if (deptActions.some((a) => a.status === "in_progress" || a.status === "completed"))
      return { label: "Started", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" }
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
      description="Track departmental items and progress for the current week"
      icon={FileSpreadsheet}
      backLinkHref="/portal/reports"
      backLinkLabel="Back to Reports"
      actions={
        tasks.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportActionTrackerToPDF(actionItemsForExport, week, year)}
              className="gap-2 border-red-200 text-red-600"
            >
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportActionTrackerToPPTX(actionItemsForExport, week, year)}
              className="gap-2 border-orange-200 text-orange-600"
            >
              <Presentation className="h-4 w-4" /> PPTX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportActionTrackerToDocx(actionItemsForExport, week, year)}
              className="gap-2 border-blue-200 text-blue-600"
            >
              <FileIcon className="h-4 w-4" /> Word
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
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-24">
              <Label className="text-muted-foreground ml-1 text-[10px] font-bold uppercase">Week</Label>
              <Input type="number" value={week} onChange={(e) => setWeek(parseInt(e.target.value) || week)} />
            </div>
            <div className="w-28">
              <Label className="text-muted-foreground ml-1 text-[10px] font-bold uppercase">Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || year)} />
            </div>
            <div className="w-52">
              <Label className="text-muted-foreground ml-1 text-[10px] font-bold uppercase">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {allDepartments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
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
              <TableHead className="font-bold">Summary</TableHead>
              <TableHead className="text-center font-bold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                  Loading departmental actions...
                </TableCell>
              </TableRow>
            ) : deptsPresent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-32 text-center font-medium">
                  No actions found.
                </TableCell>
              </TableRow>
            ) : (
              deptsPresent.map((dept) => {
                const deptActions = filteredTasks.filter((t) => t.department === dept)
                const completed = deptActions.filter((a) => a.status === "completed").length
                const total = deptActions.length
                const status = getDeptStatus(dept)
                const isMyDept = profile?.department === dept

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
                          <ChevronDown className="text-primary h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell className="font-bold">{dept}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {completed} of {total} completed
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("px-2.5 py-1 text-[10px] font-bold uppercase", status.color)}>
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
                                    <TableHead className="text-[10px] font-black tracking-widest uppercase">
                                      Action Description
                                    </TableHead>
                                    <TableHead className="w-[180px] text-[10px] font-black tracking-widest uppercase">
                                      Status
                                    </TableHead>
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
                                        {isMyDept ? (
                                          <Select
                                            value={task.status}
                                            onValueChange={(val) => handleStatusChange(task.id, val)}
                                          >
                                            <SelectTrigger
                                              className={cn(
                                                "h-8 text-[11px] font-bold uppercase",
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
                                        ) : (
                                          <Badge
                                            className={cn(
                                              "px-2.5 py-1 text-[10px] font-bold uppercase",
                                              statusColor(task.status)
                                            )}
                                          >
                                            {task.status.replace("_", " ")}
                                          </Badge>
                                        )}
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
    </AdminTablePage>
  )
}
