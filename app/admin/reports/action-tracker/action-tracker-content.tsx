"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { getCurrentISOWeek } from "@/lib/utils"

import { toast } from "sonner"
import {
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
} from "lucide-react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { ExcelImportDialog } from "@/components/admin/action-tracker/excel-import-dialog"
import { ActionFormDialog } from "@/components/admin/action-tracker/action-form-dialog"
import { ActionTrackerExportDialog } from "@/components/admin/action-tracker/export-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import * as XLSX from "xlsx"

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

interface ActionTrackerContentProps {
  initialDepartments: string[]
}

export function ActionTrackerContent({ initialDepartments }: ActionTrackerContentProps) {
  const [tasks, setTasks] = useState<ActionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [weekFilter, setWeekFilter] = useState(getCurrentISOWeek())
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [deptFilter, setDeptFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ActionTask | null>(null)

  const supabase = createClient()

  const loadTasks = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("category", "weekly_action")
        .eq("week_number", weekFilter)
        .eq("year", yearFilter)
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

  useEffect(() => {
    loadTasks()
  }, [weekFilter, yearFilter, deptFilter])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this action?")) return

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id)
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

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    pending: tasks.filter((t) => t.status !== "completed").length,
  }

  return (
    <AdminTablePage
      title="Action Tracker"
      description="Manage and monitor weekly departmental actions"
      icon={FileSpreadsheet}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Export Data
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="h-4 w-4" />
                Add Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleAdd} className="cursor-pointer gap-2">
                <Plus className="h-4 w-4" /> Bulk Manual Entry
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" /> Bulk Import (Excel)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
        <div className="mb-6 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-24">
              <Label className="text-muted-foreground px-1 text-[10px] font-bold uppercase">Week</Label>
              <Input type="number" value={weekFilter} onChange={(e) => setWeekFilter(parseInt(e.target.value))} />
            </div>
            <div className="w-28">
              <Label className="text-muted-foreground px-1 text-[10px] font-bold uppercase">Year</Label>
              <Input type="number" value={yearFilter} onChange={(e) => setYearFilter(parseInt(e.target.value))} />
            </div>
            <div className="w-48">
              <Label className="text-muted-foreground px-1 text-[10px] font-bold uppercase">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
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
          </div>
        </div>
      }
    >
      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="min-w-[300px]">Action Description</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                  Loading actions...
                </TableCell>
              </TableRow>
            ) : filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                  No actions found for this week.
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task, index) => (
                <TableRow key={task.id}>
                  <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.department}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="text-muted-foreground mt-1 line-clamp-1 text-xs">{task.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        task.priority === "urgent"
                          ? "bg-red-100 text-red-800"
                          : task.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : task.priority === "medium"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                      }
                    >
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        task.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : task.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {task.status.replace("_", " ")}
                    </Badge>
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
                        <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive gap-2">
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ExcelImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onComplete={loadTasks}
        departments={initialDepartments}
      />

      <ActionFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onComplete={loadTasks}
        departments={initialDepartments}
        editingAction={editingTask}
        defaultWeek={weekFilter}
        defaultYear={yearFilter}
      />

      <ActionTrackerExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        departments={initialDepartments}
      />
    </AdminTablePage>
  )
}
