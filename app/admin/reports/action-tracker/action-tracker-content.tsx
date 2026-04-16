"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOfficeWeek, getOfficeWeekMonday } from "@/lib/meeting-week"
import { toast } from "sonner"
import { CheckCircle2, Clock, Download, FileSpreadsheet, RefreshCw } from "lucide-react"
import { DataTable, DataTablePage } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
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
import { ActionFormDialog } from "@/components/admin/action-tracker/action-form-dialog"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { Badge } from "@/components/ui/badge"
import { QUERY_KEYS } from "@/lib/query-keys"
import { fetchWeeklyReportLockState } from "@/lib/weekly-report-lock"
import { type ActionItem } from "@/lib/export-utils"
import { logger } from "@/lib/logger"

const log = logger("reports-action-tracker-action-tracker-co")

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
  work_item_number?: string
}

interface ActionTrackerContentProps {
  initialDepartments: string[]
  scopedDepartments?: string[]
  editableDepartments?: string[]
  canGlobalEdit?: boolean
}

async function fetchAdminActionTrackerTasks(
  weekFilter: number,
  yearFilter: number,
  deptFilter: string,
  scopedDepartments: string[]
): Promise<ActionTask[]> {
  const params = new URLSearchParams({
    week: String(weekFilter),
    year: String(yearFilter),
    dept: deptFilter,
  })
  if (scopedDepartments.length > 0) {
    params.set("scoped_departments", scopedDepartments.join(","))
  }
  const response = await fetch(`/api/reports/action-tracker?${params.toString()}`, { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as { data?: ActionTask[]; error?: string } | null
  if (!response.ok) throw new Error(payload?.error || "Failed to fetch action items")
  return payload?.data || []
}

function resolveDueDate(task: ActionTask) {
  if (task.due_date) {
    const explicitDueDate = new Date(task.due_date)
    if (!Number.isNaN(explicitDueDate.getTime())) {
      return explicitDueDate
    }
  }
  const sunday = getOfficeWeekMonday(task.week_number, task.year)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 0, 0)
  return sunday
}

function formatDueDate(task: ActionTask) {
  return resolveDueDate(task).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getDueDateClassName(task: ActionTask) {
  const status = task.status.toLowerCase()
  if (status === "completed") {
    return "font-medium text-green-600 dark:text-green-400"
  }

  const dueDate = resolveDueDate(task)
  if (dueDate.getTime() < Date.now()) {
    return "font-semibold text-red-600 dark:text-red-400"
  }

  return "font-semibold text-yellow-600 dark:text-yellow-400"
}

export function ActionTrackerContent({
  initialDepartments,
  scopedDepartments = [],
  editableDepartments = [],
  canGlobalEdit = false,
}: ActionTrackerContentProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ActionTask | null>(null)
  const [weekFilter] = useState(() => {
    const week = searchParams.get("week")
    return week ? parseInt(week, 10) : currentOfficeWeek.week
  })
  const [yearFilter] = useState(() => {
    const year = searchParams.get("year")
    return year ? parseInt(year, 10) : currentOfficeWeek.year
  })
  const [deptFilter] = useState(() => searchParams.get("dept") || "all")
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isCarryForwarding, setIsCarryForwarding] = useState(false)
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false)

  const supabase = createClient()
  const canMutateTask = (task: ActionTask) => canGlobalEdit || editableDepartments.includes(task.department)

  const {
    data: tasks = [],
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.adminActionTrackerTasks({ weekFilter, yearFilter, deptFilter, scopedDepartments }),
    queryFn: () => fetchAdminActionTrackerTasks(weekFilter, yearFilter, deptFilter, scopedDepartments),
  })

  const { data: lockState } = useQuery({
    queryKey: QUERY_KEYS.adminWeeklyReportLockState(weekFilter, yearFilter),
    queryFn: () => fetchWeeklyReportLockState(supabase, weekFilter, yearFilter),
  })

  const tasksQueryKey = QUERY_KEYS.adminActionTrackerTasks({ weekFilter, yearFilter, deptFilter, scopedDepartments })

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const targetTask = tasks.find((task) => task.id === taskId)
    if (targetTask && !canMutateTask(targetTask)) {
      toast.error("You can only edit actions in your departments")
      return
    }

    const previousTasks = [...tasks]
    queryClient.setQueryData(
      tasksQueryKey,
      tasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
    )

    try {
      const response = await fetch(`/api/reports/action-tracker/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to update status")
      toast.success("Status updated")
    } catch (updateError) {
      log.error({ err: String(updateError) }, "error")
      queryClient.setQueryData(tasksQueryKey, previousTasks)
      toast.error("Failed to update status")
    }
  }

  const handleDelete = async (id: string) => {
    const targetTask = tasks.find((task) => task.id === id)
    if (targetTask && !canMutateTask(targetTask)) {
      toast.error("You can only delete actions in your departments")
      return
    }
    try {
      const response = await fetch(`/api/reports/action-tracker/${id}`, { method: "DELETE" })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to delete action")
      toast.success("Action deleted")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminActionTrackerTasks() })
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete"
      toast.error(message)
    }
  }

  const handleEdit = (task: ActionTask) => {
    if (!canMutateTask(task)) {
      toast.error("You can only edit actions in your departments")
      return
    }
    setEditingTask(task)
    setIsFormOpen(true)
  }

  const handleCarryForward = async () => {
    setIsCarryForwarding(true)
    try {
      const response = await fetch("/api/reports/action-tracker/carry-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_number: weekFilter, year: yearFilter }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string; carried_count?: number } | null
      if (!response.ok) throw new Error(payload?.error || "Failed to carry forward items")
      toast.success(`Carried forward ${payload?.carried_count || 0} items`)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminActionTrackerTasks() })
    } catch (carryForwardError) {
      toast.error(carryForwardError instanceof Error ? carryForwardError.message : "Failed to carry forward items")
    } finally {
      setIsCarryForwarding(false)
    }
  }

  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((task) => task.status === "completed").length
    const pending = tasks.filter((task) => task.status !== "completed").length
    const notStarted = tasks.filter((task) => task.status === "not_started").length
    const inProgress = tasks.filter((task) => task.status === "in_progress").length

    return { total, completed, pending, notStarted, inProgress }
  }, [tasks])

  const actionItemsForExport: ActionItem[] = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        department: task.department,
        status: task.status,
        week_number: task.week_number,
        year: task.year,
      })),
    [tasks]
  )

  const weekOptions = useMemo(
    () =>
      Array.from({ length: 53 }, (_, index) => index + 1).map((week) => ({
        value: String(week),
        label: `Week ${week}`,
      })),
    []
  )

  const yearOptions = useMemo(
    () =>
      [currentOfficeWeek.year - 1, currentOfficeWeek.year, currentOfficeWeek.year + 1, currentOfficeWeek.year + 2].map(
        (year) => ({
          value: String(year),
          label: String(year),
        })
      ),
    [currentOfficeWeek.year]
  )

  const departmentOptions = useMemo(
    () =>
      initialDepartments.map((department) => ({
        value: department,
        label: department,
      })),
    [initialDepartments]
  )

  const statusOptions = useMemo(
    () => [
      { value: "pending", label: "Pending" },
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
    ],
    []
  )

  const priorityOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => task.priority).filter((priority): priority is string => Boolean(priority)))
      )
        .sort()
        .map((priority) => ({
          value: priority,
          label: priority.replace(/_/g, " "),
        })),
    [tasks]
  )

  const columns = useMemo<DataTableColumn<ActionTask>[]>(
    () => [
      {
        key: "department",
        label: "Department",
        sortable: true,
        accessor: (task) => task.department,
        resizable: true,
        initialWidth: 180,
      },
      {
        key: "title",
        label: "Action Item",
        sortable: true,
        accessor: (task) => task.title,
        resizable: true,
        initialWidth: 260,
        render: (task) => (
          <div className="space-y-1">
            <p className="font-medium">{task.title}</p>
            {task.description ? <p className="text-muted-foreground text-xs">{task.description}</p> : null}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        accessor: (task) => task.status,
        render: (task) => (
          <Badge variant={task.status === "completed" ? "default" : "outline"} className="capitalize">
            {task.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        key: "priority",
        label: "Priority",
        sortable: true,
        accessor: (task) => task.priority,
        render: (task) => <span className="capitalize">{task.priority.replace(/_/g, " ")}</span>,
      },
      {
        key: "due_date",
        label: "Due Date",
        sortable: true,
        accessor: (task) => resolveDueDate(task).toISOString(),
        render: (task) => <span className={getDueDateClassName(task)}>{formatDueDate(task)}</span>,
      },
      {
        key: "period",
        label: "Period",
        sortable: true,
        accessor: (task) => `${task.year}-W${task.week_number}`,
        render: (task) => `W${task.week_number}, ${task.year}`,
      },
    ],
    []
  )

  const filters = useMemo<DataTableFilter<ActionTask>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        options: statusOptions,
      },
      {
        key: "department",
        label: "Department",
        options: departmentOptions,
      },
      {
        key: "priority",
        label: "Priority",
        options: priorityOptions,
      },
      {
        key: "period",
        label: "Week",
        mode: "custom",
        options: weekOptions,
        filterFn: (task, value) => {
          const weekValue = String(task.week_number)
          if (Array.isArray(value)) {
            return value.includes(weekValue)
          }
          return weekValue === value
        },
      },
      {
        key: "year_period",
        label: "Year",
        mode: "custom",
        options: yearOptions,
        filterFn: (task, value) => {
          const yearValue = String(task.year)
          if (Array.isArray(value)) {
            return value.includes(yearValue)
          }
          return yearValue === value
        },
      },
    ],
    [departmentOptions, priorityOptions, statusOptions, weekOptions, yearOptions]
  )

  return (
    <DataTablePage
      title="Action Tracker"
      description="Monitor and manage weekly departmental actions."
      icon={FileSpreadsheet}
      backLink={{ href: "/admin/reports/general-meeting", label: "Back to General Meeting" }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {tasks.length > 0 ? (
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setExportOptionsOpen(true)}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleCarryForward} disabled={isCarryForwarding} className="h-8">
            <RefreshCw className="mr-2 h-4 w-4" />
            Carry Forward
          </Button>
        </div>
      }
      stats={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total Actions"
            value={stats.total}
            icon={FileSpreadsheet}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={Clock}
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <StatCard
            title="Not Started"
            value={stats.notStarted}
            icon={Clock}
            iconBgColor="bg-red-500/10"
            iconColor="text-red-500"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={RefreshCw}
            iconBgColor="bg-violet-500/10"
            iconColor="text-violet-500"
          />
        </div>
      }
    >
      <DataTable<ActionTask>
        data={tasks}
        columns={columns}
        filters={filters}
        getRowId={(task) => task.id}
        searchPlaceholder="Search title, description, or department..."
        searchFn={(task, query) => {
          const normalizedQuery = query.toLowerCase()
          return (
            task.title.toLowerCase().includes(normalizedQuery) ||
            (task.description || "").toLowerCase().includes(normalizedQuery) ||
            task.department.toLowerCase().includes(normalizedQuery)
          )
        }}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => {
          void refetch()
        }}
        rowActions={[
          {
            label: "Mark Complete",
            onClick: (task) => {
              void handleStatusChange(task.id, "completed")
            },
          },
          {
            label: "Edit",
            onClick: (task) => handleEdit(task),
          },
          {
            label: "Delete",
            variant: "destructive",
            onClick: (task) => setPendingDeleteId(task.id),
          },
        ]}
        expandable={{
          render: (task) => (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Department</p>
                <p className="mt-2 text-sm">{task.department}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Status</p>
                <p className="mt-2 text-sm capitalize">{task.status.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Priority</p>
                <p className="mt-2 text-sm capitalize">{task.priority.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Due Date</p>
                <p className={`mt-2 text-sm ${getDueDateClassName(task)}`}>{formatDueDate(task)}</p>
              </div>
              {task.description ? (
                <div className="rounded-lg border p-4 md:col-span-4">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">Description</p>
                  <p className="mt-2 text-sm">{task.description}</p>
                </div>
              ) : null}
            </div>
          ),
        }}
        viewToggle
        cardRenderer={(task) => (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-muted-foreground text-sm">{task.department}</p>
              </div>
              <Badge variant={task.status === "completed" ? "default" : "outline"} className="capitalize">
                {task.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="grid gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span className="capitalize">{task.priority.replace(/_/g, " ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Due</span>
                <span className={getDueDateClassName(task)}>{formatDueDate(task)}</span>
              </div>
            </div>
          </div>
        )}
        emptyTitle="No actions found"
        emptyDescription="No action items matched the current filters."
        emptyIcon={FileSpreadsheet}
        skeletonRows={6}
        urlSync
      />

      <ActionFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onComplete={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminActionTrackerTasks() })}
        departments={canGlobalEdit ? initialDepartments : editableDepartments}
        editingAction={editingTask}
        defaultWeek={weekFilter}
        defaultYear={yearFilter}
      />

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this action? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) {
                  void handleDelete(pendingDeleteId)
                }
                setPendingDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportOptionsDialog
        open={exportOptionsOpen}
        onOpenChange={setExportOptionsOpen}
        title="Export Action Tracker"
        options={[
          { id: "pdf", label: "PDF", icon: "pdf" },
          { id: "pptx", label: "PowerPoint (.pptx)", icon: "pptx" },
          { id: "word", label: "Word (.docx)", icon: "word" },
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
        ]}
        onSelect={(id) => {
          if (id === "pdf") {
            void import("@/lib/action-points-export").then(({ exportActionPointsPdf }) =>
              exportActionPointsPdf(actionItemsForExport, weekFilter, yearFilter, lockState?.meetingDate)
            )
            return
          }
          if (id === "pptx") {
            void import("@/lib/export-utils").then(({ exportActionPointToPPTX }) =>
              exportActionPointToPPTX(actionItemsForExport, weekFilter, yearFilter, lockState?.meetingDate)
            )
            return
          }
          if (id === "word") {
            void import("@/lib/action-points-export").then(({ exportActionPointsDocx }) =>
              exportActionPointsDocx(actionItemsForExport, weekFilter, yearFilter, lockState?.meetingDate)
            )
            return
          }
          void import("@/lib/export-utils").then(({ exportActionPointToXLSX }) =>
            exportActionPointToXLSX(actionItemsForExport, weekFilter, yearFilter, undefined, lockState?.meetingDate)
          )
        }}
      />
    </DataTablePage>
  )
}
