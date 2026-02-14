"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { getCurrentISOWeek } from "@/lib/utils"
import { toast } from "sonner"

import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  RefreshCcw,
  Search,
  ArrowRight,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  ChevronDown,
} from "lucide-react"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionFormDialog } from "@/components/admin/action-tracker/action-form-dialog"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ActionTask {
  id: string
  title: string
  description?: string
  status: string
  priority?: string // Priority removed from new schema, keeping optimal for UI if needed or remove
  department: string
  week_number: number
  year: number
  original_week?: number
  original_year?: number
}

export default function ActionTrackerPortal() {
  const [tasks, setTasks] = useState<ActionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [week, setWeek] = useState(getCurrentISOWeek())
  const [year, setYear] = useState(new Date().getFullYear())
  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [allDepartments, setAllDepartments] = useState<string[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ActionTask | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (profile) {
      loadTasks()
    }
  }, [profile, week, year, deptFilter])

  async function fetchInitialData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase.from("profiles").select("id, department, role").eq("id", user.id).single()
      setProfile(p)

      // Fetch all departments for filtering
      const { data: depts } = await supabase.from("profiles").select("department").not("department", "is", null)
      const uniqueDepts = Array.from(new Set(depts?.map((d) => d.department).filter(Boolean))) as string[]
      setAllDepartments(uniqueDepts.sort())

      if (p?.department) {
        setDeptFilter(p.department)
      }
    } catch (error) {
      console.error("Error fetching initial data:", error)
    }
  }

  async function loadTasks() {
    setLoading(true)
    try {
      let query = supabase
        .from("action_items")
        .select("*")
        .eq("week_number", week)
        .eq("year", year)
        .order("created_at", { ascending: false })

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
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

  const handleAdd = () => {
    setEditingTask(null)
    setIsFormOpen(true)
  }

  const updateStatus = async (taskId: string, newStatus: string) => {
    setUpdatingId(taskId)
    try {
      const { error } = await supabase
        .from("action_items")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", taskId)

      if (error) throw error

      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`)
    } catch (error) {
      console.log(error)
      toast.error("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    pending: tasks.filter((t) => t.status === "pending").length,
  }

  const isLead = profile?.role === "lead" || profile?.role === "admin" || profile?.role === "super_admin"

  return (
    <AdminTablePage
      title="Departmental Action Tracker"
      description={`Tracking actions for ${deptFilter === "all" ? "Every Department" : deptFilter}`}
      icon={FileSpreadsheet}
      backLinkHref="/dashboard"
      backLinkLabel="Back to Dashboard"
      actions={
        isLead && (
          <Button onClick={handleAdd} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Bulk Manual Entry
          </Button>
        )
      }
      stats={
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card className="border-2 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-bold uppercase">
                <Clock className="h-4 w-4" /> Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-primary text-3xl font-bold">{stats.completed}</span>
                <span className="text-muted-foreground mb-1 text-lg">/ {stats.total} total actions</span>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      filters={
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Find a specific action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              className="w-24"
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value))}
              placeholder="Week"
              title="Week Number"
            />
            <Input
              type="number"
              className="w-28"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              placeholder="Year"
              title="Year"
            />
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every Department</SelectItem>
                {allDepartments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => loadTasks()} className="h-10 w-10">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      <Card className="overflow-hidden border-2 shadow-sm">
        <CardHeader className="bg-muted/30 border-b py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="text-primary h-5 w-5" />
            Weekly Action List
          </CardTitle>
          <CardDescription>Click status badge to cycle through Progress States</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead className="min-w-[400px]">Action Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-20 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Loading actions...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-20 text-center italic">
                    No actions assigned for this week.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task, index) => (
                  <TableRow key={task.id} className="group">
                    <TableCell className="text-muted-foreground text-center font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="text-foreground flex items-center gap-2 font-semibold">
                        {task.title}
                        {task.original_week && task.original_week !== task.week_number && (
                          <Badge variant="outline" className="text-muted-foreground h-5 px-1.5 text-[10px]">
                            From W{task.original_week}
                          </Badge>
                        )}
                      </div>
                      {task.description && <div className="text-muted-foreground mt-1 text-sm">{task.description}</div>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updatingId === task.id}
                            className={`flex h-9 items-center gap-2 rounded-full border-2 px-3 transition-all ${
                              task.status === "completed"
                                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                : task.status === "in_progress"
                                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  : task.status === "not_started"
                                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                    : "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                            }`}
                          >
                            <span className="flex items-center gap-2 font-medium capitalize">
                              {task.status === "completed" ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Clock className="h-4 w-4" />
                              )}
                              {task.status === "in_progress" ? "In Progress" : task.status.replace("_", " ")}
                            </span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => updateStatus(task.id, "pending")}
                            className="gap-2 font-medium text-yellow-600 focus:bg-yellow-50 focus:text-yellow-700"
                          >
                            <Clock className="h-4 w-4" /> Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus(task.id, "not_started")}
                            className="gap-2 font-medium text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                            <Clock className="h-4 w-4" /> Not Started
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus(task.id, "in_progress")}
                            className="gap-2 font-medium text-blue-600 focus:bg-blue-50 focus:text-blue-700"
                          >
                            <Clock className="h-4 w-4" /> In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus(task.id, "completed")}
                            className="gap-2 font-medium text-green-600 focus:bg-green-50 focus:text-green-700"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Completed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-right">
                      {isLead && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(task)} className="cursor-pointer gap-2">
                              <Edit2 className="h-4 w-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(task.id)}
                              className="text-destructive cursor-pointer gap-2"
                            >
                              <Trash2 className="h-4 w-4" /> Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ActionFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onComplete={loadTasks}
        departments={profile?.role === "lead" ? [profile.department] : allDepartments}
        editingAction={editingTask}
        defaultDept={deptFilter === "all" ? profile?.department || allDepartments[0] : deptFilter}
        defaultWeek={week}
        defaultYear={year}
      />
    </AdminTablePage>
  )
}
